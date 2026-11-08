import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OriginalRules, type OriginalAction } from '@fable/domain';
import { PostgresOriginalSessions } from './postgres-original-sessions';

const url = process.env.FABLE_CASINO_TEST_URL;
describe.skipIf(!url)('real PostgreSQL casino sessions', () => {
  const pool = new Pool({ connectionString: url });
  let draws = 0;
  const rules = new OriginalRules(() => {
    draws++;
    return 0;
  }, randomUUID);
  const a = new PostgresOriginalSessions(url, rules),
    b = new PostgresOriginalSessions(url, rules);
  let sessionId: string;
  beforeAll(async () => {
    const db = await pool.query('SELECT current_database() AS db');
    if (!db.rows[0].db.startsWith('fable_casino_'))
      throw new Error('Casino tests require a dedicated fable_casino_* database');
    sessionId = await a.sessionId();
    expect(await b.sessionId()).toBe(sessionId);
  });
  afterAll(async () => {
    await Promise.all([a.onModuleDestroy(), b.onModuleDestroy(), pool.end()]);
  });
  async function player() {
    const id = randomUUID();
    await pool.query(
      'INSERT INTO users(id,email,display_name,password_hash,updated_at) VALUES($1,$2,$3,$4,now())',
      [id, id + '@example.invalid', 'Fixture', 'test-only'],
    );
    return id;
  }
  const start = (gameId: string, key = randomUUID()) => ({
    sessionId,
    idempotencyKey: key,
    gameId,
    options: {},
  });
  const reveal = (version: number, cell: number): OriginalAction => ({
    sessionId,
    idempotencyKey: randomUUID(),
    expectedVersion: version,
    type: 'reveal',
    cell,
  });

  it('serializes concurrent starts and preserves player-scoped command identity', async () => {
    const p = await player(),
      other = await player(),
      input = start('paper-dice');
    const before = draws;
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, i) => (i % 2 ? a : b).start(p, input)),
    );
    expect(draws - before).toBe(1);
    for (const response of responses) expect(response).toEqual(responses[0]);
    await expect(b.start(p, { ...input, options: { chance: 20 } })).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(b.get(other, responses[0]!.id)).rejects.toMatchObject({ code: 'not_found' });
    expect((await b.start(other, input)).id).not.toBe(responses[0]!.id);
    expect(await a.list(p)).toHaveLength(1);
    await expect(a.start(p, { ...input, sessionId: randomUUID() })).rejects.toMatchObject({
      code: 'session_changed',
    });
    expect(
      await pool
        .query('SELECT 1 FROM casino_demo_commands WHERE player_id=$1', [p])
        .then((r) => r.rowCount),
    ).toBe(1);
  });
  it('permits one active board, one winning version and exact historical replay', async () => {
    const p = await player();
    const starts = await Promise.allSettled([
      a.start(p, start('fable-mines')),
      b.start(p, start('fable-mines')),
    ]);
    expect(starts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(starts.filter((r) => r.status === 'rejected')[0]?.reason).toMatchObject({
      code: 'conflict',
    });
    const round = (await a.list(p))[0]!;
    expect(round.mines?.locations).toBeUndefined();
    const actions = [reveal(0, 24), reveal(0, 23)];
    const results = await Promise.allSettled([
      a.act(p, round.id, actions[0]!),
      b.act(p, round.id, actions[1]!),
    ]);
    const win = results.findIndex((r) => r.status === 'fulfilled');
    expect(win).toBeGreaterThanOrEqual(0);
    expect(results.filter((r) => r.status === 'rejected')[0]?.reason).toMatchObject({
      code: 'conflict',
    });
    const beforeFinish = await b.get(p, round.id);
    const finish: OriginalAction = {
      sessionId,
      idempotencyKey: randomUUID(),
      expectedVersion: 1,
      type: 'finish',
    };
    const completed = await Promise.all([a.act(p, round.id, finish), b.act(p, round.id, finish)]);
    expect(completed[0]).toEqual(completed[1]);
    expect(completed[0]).toMatchObject({ status: 'complete', version: 2, returnPoints: 112 });
    expect(await b.act(p, round.id, actions[win]!)).toEqual(beforeFinish);
    await expect(b.act(p, round.id, reveal(2, 22))).rejects.toMatchObject({ code: 'conflict' });
  });
  it('rolls back round creation and advancement if recording the command fails', async () => {
    const p = await player(),
      key = randomUUID(),
      suffix = p.replaceAll('-', '');
    const name = 'casino_test_fail_' + suffix;
    await pool.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected casino command failure'; END $$;
      CREATE TRIGGER ${name} BEFORE INSERT ON casino_demo_commands FOR EACH ROW WHEN (NEW.player_id='${p}' AND NEW.request_key='${key}') EXECUTE FUNCTION ${name}()`);
    const input = start('fable-mines', key);
    try {
      await expect(a.start(p, input)).rejects.toThrow('injected casino command failure');
      expect(await b.list(p)).toHaveLength(0);
      const initial = await a.start(p, start('fable-mines'));
      const action = { ...reveal(0, 24), idempotencyKey: key };
      await expect(b.act(p, initial.id, action)).rejects.toThrow('injected casino command failure');
      expect(await a.get(p, initial.id)).toEqual(initial);
      expect(
        (
          await pool.query(
            'SELECT 1 FROM casino_demo_commands WHERE player_id=$1 AND request_key=$2',
            [p, key],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await pool.query(`DROP TRIGGER ${name} ON casino_demo_commands; DROP FUNCTION ${name}()`);
    }
    const initial = (await b.list(p))[0]!;
    expect(await b.act(p, initial.id, { ...reveal(0, 24), idempotencyKey: key })).toMatchObject({
      version: 1,
    });
  });
  it('rejects missing revision records, command edits, terminal changes and mismatched ownership in SQL', async () => {
    const p = await player(),
      other = await player(),
      round = await a.start(p, start('fable-mines'));
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const next = rules.advance(
        { public: round, mines: [0, 1, 2] },
        reveal(0, 24),
        round.updatedAt,
      ).public;
      await tx.query('UPDATE casino_demo_rounds SET revision=1,public_result=$1 WHERE id=$2', [
        JSON.stringify(next),
        round.id,
      ]);
      await expect(tx.query('COMMIT')).rejects.toThrow('matching replay record');
    } finally {
      await tx.query('ROLLBACK');
      tx.release();
    }
    expect(await b.get(p, round.id)).toEqual(round);
    const revealMine = { ...round, version: 1, mines: { mineCount: 3, revealed: [0] } };
    await expect(
      pool.query('UPDATE casino_demo_rounds SET revision=1,public_result=$1 WHERE id=$2', [
        JSON.stringify(revealMine),
        round.id,
      ]),
    ).rejects.toThrow('A mine ends the round');
    await expect(
      pool.query('UPDATE casino_demo_commands SET fingerprint=$1 WHERE round_id=$2', [
        'changed',
        round.id,
      ]),
    ).rejects.toThrow('immutable');
    await expect(
      pool.query(
        `INSERT INTO casino_demo_commands(player_id,request_key,round_id,operation,fingerprint,revision,response)
        SELECT $1,'other-owner-key',round_id,operation,fingerprint,revision,response FROM casino_demo_commands WHERE round_id=$2`,
        [other, round.id],
      ),
    ).rejects.toThrow();
    const loss = await b.act(p, round.id, reveal(0, 0));
    await expect(
      pool.query('UPDATE casino_demo_rounds SET revision=revision+1 WHERE id=$1', [round.id]),
    ).rejects.toThrow('transition');
    expect(await a.get(p, round.id)).toEqual(loss);
  });
  it('bounds retries on transient PostgreSQL errors and safely accepts a later caller retry', async () => {
    const p = await player();
    const input = start('paper-dice');
    const name = 'casino_retry_' + p.replaceAll('-', '');
    // A PostgreSQL sequence counts attempts even when their transactions roll back.
    await pool.query(`CREATE SEQUENCE ${name}_attempt;
      CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE retry_code text;
      BEGIN
        retry_code := CASE nextval('${name}_attempt') WHEN 1 THEN '40P01' WHEN 2 THEN '55P03' WHEN 3 THEN '40001' END;
        IF retry_code IS NOT NULL THEN RAISE EXCEPTION 'injected contention' USING ERRCODE=retry_code; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER ${name} BEFORE INSERT ON casino_demo_commands FOR EACH ROW WHEN (NEW.player_id='${p}') EXECUTE FUNCTION ${name}()`);
    try {
      await expect(a.start(p, input)).rejects.toMatchObject({ code: 'unavailable' });
      expect((await pool.query(`SELECT last_value::int AS n FROM ${name}_attempt`)).rows[0].n).toBe(
        3,
      );
      expect(await b.list(p)).toEqual([]);
      const result = await b.start(p, input);
      expect(await a.start(p, input)).toEqual(result);
      expect((await pool.query(`SELECT last_value::int AS n FROM ${name}_attempt`)).rows[0].n).toBe(
        4,
      );
    } finally {
      await pool.query(
        `DROP TRIGGER ${name} ON casino_demo_commands; DROP FUNCTION ${name}(); DROP SEQUENCE ${name}_attempt`,
      );
    }
  });
});

it('fails closed without PostgreSQL configuration', async () => {
  const missing = new PostgresOriginalSessions(undefined);
  await expect(missing.sessionId()).rejects.toMatchObject({ code: 'unavailable' });
  await expect(
    missing.start(randomUUID(), {
      sessionId: randomUUID(),
      idempotencyKey: randomUUID(),
      gameId: 'paper-dice',
      options: {},
    }),
  ).rejects.toMatchObject({ code: 'unavailable' });
});
