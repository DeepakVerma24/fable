import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const url = process.env.FABLE_POSTGRES_TEST_URL;
if (!url)
  throw new Error('FABLE_POSTGRES_TEST_URL must point to the dedicated migrated test database');
const children = [];
async function port() {
  const s = createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}
async function start() {
  const p = await port();
  const env = {
    ...process.env,
    PORT: String(p),
    DATABASE_URL: url,
    FABLE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    OTEL_ENABLED: 'false',
  };
  for (const k of ['REDIS_URL', 'SENTRY_DSN', 'OTEL_EXPORTER_OTLP_ENDPOINT']) delete env[k];
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: fileURLToPath(new URL('../apps/api/', import.meta.url)),
    env,
    windowsHide: true,
    stdio: 'ignore',
  });
  children.push(child);
  const base = `http://127.0.0.1:${p}`;
  for (let i = 0; i < 300; i++) {
    try {
      const r = await fetch(base + '/health');
      if (r.ok) return base;
    } catch {}
    if (child.exitCode !== null) throw new Error('API process exited');
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('API startup timed out');
}
async function register(base) {
  const r = await fetch(base + '/auth/csrf');
  const j = await r.json();
  const response = await fetch(base + '/auth/register', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: r.headers
        .getSetCookie()
        .map((x) => x.split(';')[0])
        .join('; '),
      'x-fable-csrf': j.csrfToken,
    },
    body: JSON.stringify({
      email: `${crypto.randomUUID()}@example.invalid`,
      password: 'integration-password-only',
      displayName: 'Integration',
    }),
  });
  assert.equal(response.status, 201);
  const player = await response.json();
  return {
    cookie: response.headers
      .getSetCookie()
      .map((x) => x.split(';')[0])
      .join('; '),
    'x-fable-csrf': player.csrfToken,
  };
}
async function bet(base, headers, key, stake = '50000') {
  const r = await fetch(base + '/demo/bets', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: key,
      selectionId: 'fbl-north-harbor-result-home',
      stakeMinor: stake,
    }),
  });
  return { status: r.status, body: await r.json() };
}
try {
  const a = await start(),
    b = await start();
  const headers = await register(a);
  const spent = await Promise.all([
    bet(a, headers, crypto.randomUUID()),
    bet(b, headers, crypto.randomUUID()),
    bet(a, headers, crypto.randomUUID()),
  ]);
  assert.equal(spent.filter((x) => x.status === 201).length, 2);
  assert.equal(spent.filter((x) => x.status === 400).length, 1);
  const wallet = await fetch(b + '/wallet', { headers });
  assert.equal((await wallet.json()).availableMinor, '0');
  const other = await register(b);
  const key = crypto.randomUUID();
  const replay = await Promise.all([bet(a, other, key, '100'), bet(b, other, key, '100')]);
  assert.equal(replay[0].status, 201);
  assert.deepEqual(replay[0], replay[1]);
  assert.equal((await bet(a, other, key, '200')).status, 409);
  console.log(
    'PASS: two API processes, shared PostgreSQL, no overspend, concurrent replay, changed-payload conflict',
  );
} finally {
  await Promise.all(
    children.map(
      (c) =>
        new Promise((r) => {
          if (c.exitCode !== null) return r();
          c.once('exit', r);
          c.kill();
        }),
    ),
  );
}
