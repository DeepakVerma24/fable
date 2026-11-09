import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const databaseRequire = createRequire(
  new URL('../packages/database/package.json', import.meta.url),
);
const { Pool } = databaseRequire('pg');
const url = process.env.FABLE_CASINO_TEST_URL;
if (!url || !/^\/fable_casino_[a-z0-9_]+$/.test(new URL(url).pathname))
  throw new Error(
    'Set FABLE_CASINO_TEST_URL to a migrated, dedicated fable_casino_* test database.',
  );

const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
const children = [];
const rounds = '/casino/demo/rounds';

async function eventually(check, message, timeout = 30000) {
  const end = Date.now() + timeout;
  do {
    const value = await check();
    if (value) return value;
    await delay(40);
  } while (Date.now() < end);
  throw new Error(message);
}

async function startApi() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close((err) => (err ? reject(err) : resolve())));
  const env = {
    ...process.env,
    DATABASE_URL: url,
    PORT: String(port),
    FABLE_ENV: 'test',
    OTEL_ENABLED: 'false',
    LOG_LEVEL: 'fatal',
  };
  for (const key of ['REDIS_URL', 'OTEL_EXPORTER_OTLP_ENDPOINT', 'SENTRY_DSN']) delete env[key];
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: fileURLToPath(new URL('../apps/api/', import.meta.url)),
    env,
    windowsHide: true,
    stdio: 'ignore',
  });
  children.push(child);
  await once(child, 'spawn');
  const base = 'http://127.0.0.1:' + port;
  await eventually(async () => {
    if (child.exitCode !== null || child.signalCode) throw new Error('API exited during startup');
    try {
      const response = await fetch(base + '/health');
      await response.arrayBuffer();
      return response.ok;
    } catch {
      return false;
    }
  }, 'Timed out waiting for the API');
  return { base, child };
}

async function kill(child) {
  if (child.exitCode !== null || child.signalCode) return;
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
}

function cookies(response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}

async function register(api) {
  const csrf = await fetch(api.base + '/auth/csrf');
  assert.equal(csrf.status, 200);
  const response = await fetch(api.base + '/auth/register', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: cookies(csrf),
      'x-fable-csrf': (await csrf.json()).csrfToken,
    },
    body: JSON.stringify({
      email: randomUUID() + '@example.invalid',
      displayName: 'Casino recovery',
      password: 'local-test-password',
    }),
  });
  assert.equal(response.status, 201);
  return { cookie: cookies(response), 'x-fable-csrf': (await response.json()).csrfToken };
}

async function request(api, actor, path, body, expected = body ? 201 : 200) {
  const response = await fetch(api.base + path, {
    method: body ? 'POST' : 'GET',
    headers: { ...actor, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (expected !== null) assert.equal(response.status, expected, path + ' ' + (data.message ?? ''));
  return { data, status: response.status };
}

async function wallet(api, actor) {
  return Promise.all(
    ['/wallet', '/wallet/transactions'].map(async (path) => (await request(api, actor, path)).data),
  );
}

// Pause this fixture's writer after its round update and before it can insert the replay response.
async function interruptReveal(a, b, actor, owner, initial, command) {
  const name = 'casino_pause_' + randomUUID().replaceAll('-', '');
  const lockClass = 703136,
    token = randomInt(1, 2147483647);
  const gate = await pool.connect();
  const path = rounds + '/' + initial.id;
  let installed = false;
  try {
    await gate.query('SELECT pg_advisory_lock($1::int,$2::int)', [lockClass, token]);
    // Only server/fixture-generated UUIDs and integers are interpolated into this test-only DDL.
    assert.match(owner, /^[a-f0-9-]{36}$/);
    assert.match(command.idempotencyKey, /^[a-f0-9-]{36}$/);
    await gate.query(
      'CREATE FUNCTION ' +
        name +
        '() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(' +
        lockClass +
        ',' +
        token +
        '); RETURN NEW; END $$; ' +
        'CREATE TRIGGER ' +
        name +
        " BEFORE INSERT ON casino_demo_commands FOR EACH ROW WHEN (NEW.player_id='" +
        owner +
        "' AND NEW.request_key='" +
        command.idempotencyKey +
        "') EXECUTE FUNCTION " +
        name +
        '()',
    );
    installed = true;
    const interrupted = request(a, actor, path + '/actions', command, null).then(
      (result) => result.status,
      () => 'disconnected',
    );
    const backend = await eventually(async () => {
      const waiters = await pool.query(
        "SELECT l.pid FROM pg_locks l JOIN pg_stat_activity s ON s.pid=l.pid WHERE s.application_name='fable-casino' AND l.locktype='advisory' AND l.classid=$1 AND l.objid=$2 AND l.objsubid=2 AND NOT l.granted",
        [lockClass, token],
      );
      return waiters.rows[0]?.pid;
    }, 'The real casino transaction never reached the commit gate');
    assert.deepEqual((await request(b, actor, path)).data, initial);
    await kill(a.child);
    assert.equal(await interrupted, 'disconnected');
    await gate.query('SELECT pg_advisory_unlock($1::int,$2::int)', [lockClass, token]);
    await eventually(
      async () =>
        (
          await pool.query(
            'SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND xact_start IS NOT NULL',
            [backend],
          )
        ).rowCount === 0,
      'Interrupted PostgreSQL transaction did not roll back',
    );
    assert.equal(
      (
        await pool.query(
          'SELECT 1 FROM casino_demo_commands WHERE player_id=$1 AND request_key=$2',
          [owner, command.idempotencyKey],
        )
      ).rowCount,
      0,
    );
    assert.deepEqual((await request(b, actor, path)).data, initial);
  } finally {
    try {
      await gate.query('SELECT pg_advisory_unlock_all()');
      if (installed)
        await gate.query(
          'DROP TRIGGER ' + name + ' ON casino_demo_commands; DROP FUNCTION ' + name + '()',
        );
    } finally {
      gate.release();
    }
  }
}

try {
  assert.match(
    (await pool.query('SELECT current_database() AS name')).rows[0].name,
    /^fable_casino_[a-z0-9_]+$/,
  );
  const a = await startApi(),
    b = await startApi();
  const actor = await register(a),
    other = await register(b);
  const owner = (await request(b, actor, '/auth/me')).data.player.id;
  const before = await wallet(b, actor);
  const session = (await request(a, actor, '/casino/demo/session')).data;
  assert.equal(session.persistence, 'postgresql');
  assert.deepEqual((await request(b, actor, '/casino/demo/session')).data, session);
  const { sessionId } = session;
  const start = (gameId) => ({ sessionId, gameId, options: {}, idempotencyKey: randomUUID() });
  const diceCommand = start('paper-dice');
  const replay = await Promise.all(
    Array.from({ length: 8 }, (_, i) => request(i % 2 ? a : b, actor, rounds, diceCommand)),
  );
  const dice = replay[0].data;
  for (const response of replay) assert.deepEqual(response.data, dice);
  await request(b, actor, rounds, { ...diceCommand, options: { chance: 55 } }, 409);
  await request(b, other, rounds + '/' + dice.id, undefined, 404);
  assert.deepEqual((await request(b, other, rounds)).data.items, []);
  // Ignore the committed response, keeping only the original request. Replay it after restart.
  const plinkoCommand = start('fable-plinko');
  const discarded = await fetch(a.base + rounds, {
    method: 'POST',
    headers: { ...actor, 'content-type': 'application/json' },
    body: JSON.stringify(plinkoCommand),
  });
  assert.equal(discarded.status, 201);
  await discarded.body?.cancel();
  const plinkoSnapshot = (
    await pool.query(
      'SELECT response FROM casino_demo_commands WHERE player_id=$1 AND request_key=$2',
      [owner, plinkoCommand.idempotencyKey],
    )
  ).rows[0].response;
  const limbo = (await request(a, actor, rounds, start('fable-limbo'))).data;
  console.log(
    'PASS shared login, player isolation, stable namespace and exact cross-process replay',
  );

  const starts = await Promise.all([
    request(a, actor, rounds, start('fable-mines'), null),
    request(b, actor, rounds, start('fable-mines'), null),
  ]);
  assert.deepEqual(starts.map((x) => x.status).sort(), [201, 409]);
  const [writer, survivor] = starts[0].status === 201 ? [a, b] : [b, a];
  const board = starts.find((x) => x.status === 201).data;
  assert.equal(board.mines.locations, undefined);
  // This privileged test query chooses a known safe reveal without altering or exposing the sampled board.
  const hidden = (
    await pool.query('SELECT private_mines FROM casino_demo_rounds WHERE id=$1', [board.id])
  ).rows[0].private_mines;
  const safe = Array.from({ length: 25 }, (_, i) => i).filter((i) => !hidden.includes(i));
  const path = rounds + '/' + board.id;
  const retry = {
    sessionId,
    expectedVersion: 0,
    type: 'reveal',
    cell: safe[0],
    idempotencyKey: randomUUID(),
  };
  await interruptReveal(writer, survivor, actor, owner, board, retry);
  console.log(
    'PASS API killed inside an open Mines transaction, uncommitted revision and command both rolled back',
  );

  const advanced = (await request(survivor, actor, path + '/actions', retry)).data;
  assert.equal(advanced.version, 1);
  assert.deepEqual(advanced.mines.revealed, [safe[0]]);
  assert.equal(advanced.mines.locations, undefined);
  const restarted = await startApi();
  assert.deepEqual((await request(restarted, actor, '/casino/demo/session')).data, session);
  assert.deepEqual((await request(restarted, actor, path)).data, advanced);
  for (const completed of [dice, plinkoSnapshot, limbo])
    assert.deepEqual(
      (await request(restarted, actor, rounds + '/' + completed.id)).data,
      completed,
    );
  assert.deepEqual((await request(restarted, actor, rounds, plinkoCommand)).data, plinkoSnapshot);
  console.log(
    'PASS active board, completed games and a discarded committed response recovered on a replacement API',
  );

  const competing = safe
    .slice(1, 3)
    .map((cell) => ({ ...retry, expectedVersion: 1, cell, idempotencyKey: randomUUID() }));
  const moves = await Promise.all(
    competing.map((cmd, i) =>
      request(i ? restarted : survivor, actor, path + '/actions', cmd, null),
    ),
  );
  assert.deepEqual(moves.map((x) => x.status).sort(), [201, 409]);
  const second = moves.find((x) => x.status === 201).data;
  assert.equal(second.version, 2);
  const finish = { sessionId, expectedVersion: 2, type: 'finish', idempotencyKey: randomUUID() };
  const finished = await Promise.all([
    request(survivor, actor, path + '/actions', finish),
    request(restarted, actor, path + '/actions', finish),
  ]);
  assert.deepEqual(finished[0].data, finished[1].data);
  assert.deepEqual(finished[0].data.mines.locations, hidden);
  assert.equal(finished[0].data.status, 'complete');
  assert.equal(finished[0].data.version, 3);
  await request(
    restarted,
    actor,
    path + '/actions',
    { ...retry, expectedVersion: 3, idempotencyKey: randomUUID() },
    409,
  );
  assert.deepEqual((await request(restarted, actor, path + '/actions', retry)).data, advanced);
  assert.deepEqual((await request(survivor, actor, path)).data, finished[0].data);
  assert.equal((await request(survivor, actor, rounds)).data.items.length, 4);
  assert.equal(
    (await pool.query('SELECT 1 FROM casino_demo_commands WHERE player_id=$1', [owner])).rowCount,
    7,
  );
  assert.deepEqual(await wallet(survivor, actor), before);
  console.log(
    'PASS competing revisions, duplicate finish, historical replay, terminal rejection and unchanged wallet history',
  );
  await Promise.all([kill(survivor.child), kill(restarted.child)]);
  const fresh = await startApi();
  assert.deepEqual((await request(fresh, actor, '/casino/demo/session')).data, session);
  for (const round of [dice, plinkoSnapshot, limbo, finished[0].data])
    assert.deepEqual((await request(fresh, actor, rounds + '/' + round.id)).data, round);
  console.log('PASS all four completed games survived replacement of every API in the fixture');
} finally {
  try {
    await Promise.all(children.map(kill));
  } finally {
    await pool.end();
  }
}
