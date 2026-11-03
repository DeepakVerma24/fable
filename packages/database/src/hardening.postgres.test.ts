import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DemoBetOperations,
  DemoWallet,
  Ledger,
  reservationLines,
  settlementLines,
} from '@fable/domain';
import { createPrismaClient } from './prisma';
import { PrismaLedgerStore } from './prisma-ledger-store';
import { PrismaBetStore } from './prisma-bet-store';

const url = process.env.FABLE_POSTGRES_TEST_URL;
const names = [
  '20261101120000_init',
  '20261101183000_player_auth',
  '20261103020000_financial_integrity',
  '20261103140000_financial_hardening',
];
const sql = names.map((name) =>
  readFileSync(path.join(process.cwd(), 'prisma/migrations', name, 'migration.sql'), 'utf8'),
);
describe.skipIf(!url)('Phase 7.1 real PostgreSQL regressions', () => {
  const admin = new Pool({ connectionString: url });
  const suffix = randomUUID().replaceAll('-', '');
  const group = `fw_${suffix}`,
    runtime = `api_${suffix}`,
    worker = `worker_${suffix}`;
  const databases: { name: string; pool: Pool }[] = [];
  let pool: Pool;
  let databaseUrl: string;
  let a: ReturnType<typeof createPrismaClient>, b: ReturnType<typeof createPrismaClient>;
  let first: DemoBetOperations, second: DemoBetOperations;
  async function fixture(count = 4) {
    const name = `hardening_${randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE DATABASE ${name}`);
    const connection = new URL(url!);
    connection.pathname = `/${name}`;
    const p = new Pool({ connectionString: connection.toString() });
    databases.push({ name, pool: p });
    for (const migration of sql.slice(0, count)) await p.query(migration);
    return { pool: p, url: connection.toString() };
  }
  beforeAll(async () => {
    const f = await fixture();
    pool = f.pool;
    databaseUrl = f.url;
    a = createPrismaClient(f.url);
    b = createPrismaClient(f.url);
    first = new DemoBetOperations(new PrismaBetStore(a));
    second = new DemoBetOperations(new PrismaBetStore(b));
    await pool.query(`CREATE ROLE ${group} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
      CREATE ROLE ${runtime} NOLOGIN IN ROLE ${group}; CREATE ROLE ${worker} NOLOGIN IN ROLE ${group};
      GRANT USAGE ON SCHEMA public TO ${group};
      GRANT SELECT,INSERT ON ledger_accounts,ledger_transactions,ledger_entries,audit_log TO ${group};
      GRANT UPDATE ON ledger_accounts TO ${group};
      GRANT SELECT,INSERT,UPDATE ON demo_bets TO ${group};`);
  }, 30000);
  afterAll(async () => {
    await a?.$disconnect();
    await b?.$disconnect();
    for (const item of databases) {
      await item.pool.end();
      await admin.query(`DROP DATABASE ${item.name}`);
    }
    await admin.query(`DROP ROLE IF EXISTS ${runtime}, ${worker}, ${group}`);
    await admin.end();
  });
  async function accounts(p = pool) {
    const wallet = randomUUID(),
      house = randomUUID();
    await p.query(
      `INSERT INTO ledger_accounts(id,code,type,currency) VALUES ($1,$2,'USER_WALLET','FBU'),($3,$4,'HOUSE','FBU')`,
      [wallet, `wallet.${wallet}`, house, `house.${house}`],
    );
    return { wallet, house };
  }
  async function header(c: PoolClient) {
    const id = randomUUID();
    await c.query(
      `INSERT INTO ledger_transactions(id,idempotency_key,kind) VALUES ($1,$2,'SIMULATED_ADJUSTMENT')`,
      [id, id],
    );
    return id;
  }
  async function entries(
    c: PoolClient,
    id: string,
    ac: { wallet: string; house: string },
    spend = false,
    amount = 100,
  ) {
    await c.query(
      `INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,$4,$5,'FBU'),($6,$2,$7,$8,$5,'FBU')`,
      [
        randomUUID(),
        id,
        ac.wallet,
        spend ? 'DEBIT' : 'CREDIT',
        amount,
        randomUUID(),
        ac.house,
        spend ? 'CREDIT' : 'DEBIT',
      ],
    );
  }
  async function seed(ac: { wallet: string; house: string }, p = pool) {
    const c = await p.connect();
    try {
      await c.query('BEGIN');
      const id = await header(c);
      await entries(c, id, ac);
      await c.query('COMMIT');
      return id;
    } finally {
      c.release();
    }
  }
  async function balance(wallet: string, p = pool) {
    return (
      await p.query(
        `SELECT COALESCE(sum(CASE WHEN direction='CREDIT' THEN amount_minor ELSE -amount_minor END),0)::text AS n FROM ledger_entries WHERE account_id=$1`,
        [wallet],
      )
    ).rows[0].n;
  }
  async function blocked(pid: number) {
    for (let i = 0; i < 150; i++) {
      // pg_stat_activity snapshots may be cached within the observer transaction.
      await admin.query('SELECT pg_stat_clear_snapshot()');
      const result = await admin.query(
        'SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',
        [pid],
      );
      if (result.rows[0]?.wait_event_type === 'Lock') return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('Expected a database lock wait');
  }
  for (const role of ['owner', runtime, worker]) {
    for (const mode of ['header', 'immediate', 'toggle']) {
      it(`P1-01 ${role} rejects early constraint bypass (${mode})`, async () => {
        const ac = await accounts(),
          c = await pool.connect();
        let id = '';
        try {
          await c.query('BEGIN');
          if (role !== 'owner') await c.query(`SET LOCAL ROLE ${role}`);
          id = await header(c);
          await entries(c, id, ac);
          await c.query(
            mode === 'header'
              ? 'SET CONSTRAINTS ledger_transactions_must_balance IMMEDIATE'
              : 'SET CONSTRAINTS ALL IMMEDIATE',
          );
          if (mode === 'toggle') await c.query('SET CONSTRAINTS ALL DEFERRED');
          const insert = () =>
            c.query(
              `INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,'CREDIT',25,'FBU')`,
              [randomUUID(), id, ac.wallet],
            );
          if (mode === 'immediate') await expect(insert()).rejects.toThrow('balanced');
          else {
            await insert();
            await expect(c.query('COMMIT')).rejects.toThrow('balanced');
          }
          await c.query('ROLLBACK');
          expect(
            (await pool.query('SELECT id FROM ledger_transactions WHERE id=$1', [id])).rowCount,
          ).toBe(0);
          expect(await balance(ac.wallet)).toBe('0');
        } finally {
          await c.query('ROLLBACK');
          c.release();
        }
      });
    }
    if (role === 'owner') continue;
    it(
      'P1-01 preserves sealing/currency and denies guard or trigger tampering for ' + role,
      async () => {
        const ac = await accounts(),
          id = await seed(ac),
          c = await pool.connect();
        try {
          await c.query(`SET ROLE ${role}`);
          await expect(
            c.query(
              `INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,'CREDIT',1,'FBU')`,
              [randomUUID(), id, ac.wallet],
            ),
          ).rejects.toThrow('sealed');
          await expect(c.query('UPDATE ledger_account_fences SET revision=0')).rejects.toThrow(
            'permission denied',
          );
          await expect(c.query('ALTER TABLE ledger_entries DISABLE TRIGGER ALL')).rejects.toThrow();
          await expect(c.query("SET session_replication_role='replica'")).rejects.toThrow();
          await expect(c.query('DELETE FROM ledger_entries')).rejects.toThrow();
          await c.query('BEGIN');
          const fresh = await header(c);
          await expect(
            c.query(
              `INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,'CREDIT',1,'USD')`,
              [randomUUID(), fresh, ac.wallet],
            ),
          ).rejects.toThrow('currency');
        } finally {
          await c.query('ROLLBACK');
          await c.query('RESET ROLE');
          c.release();
        }
      },
    );
  }
  for (const isolation of ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']) {
    it('P1-02 prevents double spend under ' + isolation, async () => {
      const ac = await accounts();
      await seed(ac);
      const x = await pool.connect(),
        y = await pool.connect();
      try {
        for (const c of [x, y]) {
          await c.query('BEGIN ISOLATION LEVEL ' + isolation);
          await c.query(`SET LOCAL ROLE ${c === x ? runtime : worker}`);
          await c.query('SELECT count(*) FROM ledger_entries');
        }
        const xid = await header(x),
          yid = await header(y);
        await entries(x, xid, ac, true, 80);
        const pid = (await y.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        const wait = entries(y, yid, ac, true, 80).then(
          () => null,
          (e: Error & { code: string }) => e,
        );
        await blocked(pid);
        await x.query('COMMIT');
        const error = await wait;
        if (isolation === 'READ COMMITTED') {
          expect(error).toBeNull();
          await expect(y.query('COMMIT')).rejects.toThrow('insufficient wallet');
        } else expect(error?.code).toBe('40001');
        await y.query('ROLLBACK');
        expect(await balance(ac.wallet)).toBe('20');
        // A fresh retry sees the committed debit and fails safely, not a stale snapshot.
        await y.query('BEGIN ISOLATION LEVEL ' + isolation);
        await entries(y, await header(y), ac, true, 80);
        await expect(y.query('COMMIT')).rejects.toThrow('insufficient wallet');
        expect(await balance(ac.wallet)).toBe('20');
      } finally {
        await x.query('ROLLBACK');
        await y.query('ROLLBACK');
        x.release();
        y.release();
      }
    });
  }
  it('P1-02 rolls back fence metadata with failed postings and has no balance projection', async () => {
    const ac = await accounts();
    await seed(ac);
    const before = await pool.query(
      'SELECT revision FROM ledger_account_fences WHERE account_id=$1',
      [ac.wallet],
    );
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await entries(c, await header(c), ac, true, 101);
      await expect(c.query('COMMIT')).rejects.toThrow('insufficient');
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
    expect(
      (
        await pool.query('SELECT revision FROM ledger_account_fences WHERE account_id=$1', [
          ac.wallet,
        ])
      ).rows,
    ).toEqual(before.rows);
    expect(await balance(ac.wallet)).toBe('100');
  });
  it('P1-03 final migration waits before preflight and rejects corruption committed by an older writer', async () => {
    const f = await fixture(3),
      p = f.pool,
      ac = await accounts(p);
    await seed(ac, p);
    const writer = await p.connect(),
      migrator = await p.connect();
    try {
      await writer.query('BEGIN');
      const id = await header(writer);
      await entries(writer, id, ac);
      await writer.query('SET CONSTRAINTS ledger_transactions_must_balance IMMEDIATE');
      const pid = (await migrator.query('SELECT pg_backend_pid() pid')).rows[0].pid;
      const migration = migrator.query(sql[3]!).then(
        () => null,
        (e: Error) => e,
      );
      await blocked(pid);
      await writer.query(
        `INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,'CREDIT',25,'FBU')`,
        [randomUUID(), id, ac.wallet],
      );
      await writer.query('COMMIT');
      expect((await migration)?.message).toContain('historical journal imbalance');
      await migrator.query('ROLLBACK');
      expect(
        (await p.query("SELECT to_regclass('public.ledger_account_fences') name")).rows[0].name,
      ).toBeNull();
      await expect(p.query(sql[3]!)).rejects.toThrow('historical journal imbalance');
      await p.query('ROLLBACK');
      expect(await balance(ac.wallet, p)).toBe('225'); // unchanged, never silently corrected
    } finally {
      await writer.query('ROLLBACK');
      await migrator.query('ROLLBACK');
      writer.release();
      migrator.release();
    }
  });
  it('P1-03 an aborted old writer lets migration retry safely with unchanged history', async () => {
    const f = await fixture(3),
      p = f.pool,
      ac = await accounts(p);
    await seed(ac, p);
    const writer = await p.connect(),
      migrator = await p.connect();
    try {
      await writer.query('BEGIN');
      await entries(writer, await header(writer), ac);
      const pid = (await migrator.query('SELECT pg_backend_pid() pid')).rows[0].pid;
      const migration = migrator.query(sql[3]!);
      await blocked(pid);
      await writer.query('ROLLBACK');
      await migration;
      expect(await balance(ac.wallet, p)).toBe('100');
      expect((await p.query('SELECT count(*) n FROM ledger_account_fences')).rows[0].n).toBe('2');
    } finally {
      await writer.query('ROLLBACK');
      writer.release();
      migrator.release();
    }
  });
  it('financial stores refuse a database before the final hardening migration', async () => {
    const f = await fixture(3),
      db = createPrismaClient(f.url);
    try {
      await expect(
        new DemoWallet(new Ledger(new PrismaLedgerStore(db))).grant(randomUUID()),
      ).rejects.toThrow('fable_require_financial_hardening');
    } finally {
      await db.$disconnect();
    }
  });
  it('P1-03 full upgrade refuses corruption missed by the original Phase 7 migration', async () => {
    const f = await fixture(2),
      p = f.pool,
      ac = await accounts(p),
      id = await seed(ac, p);
    const writer = await p.connect(),
      migrator = await p.connect();
    try {
      await writer.query('BEGIN');
      await writer.query('LOCK TABLE ledger_transactions IN ACCESS SHARE MODE');
      const pid = (await migrator.query('SELECT pg_backend_pid() pid')).rows[0].pid;
      const originalMigration = migrator.query(sql[2]!);
      await blocked(pid);
      await writer.query(
        `INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,'CREDIT',25,'FBU')`,
        [randomUUID(), id, ac.wallet],
      );
      await writer.query('COMMIT');
      await originalMigration;
      await expect(migrator.query(sql[3]!)).rejects.toThrow('historical journal imbalance');
      await migrator.query('ROLLBACK');
      expect(
        (
          await p.query(
            "SELECT to_regprocedure('public.fable_require_financial_hardening()') ready",
          )
        ).rows[0].ready,
      ).toBeNull();
      expect(await balance(ac.wallet, p)).toBe('125');
    } finally {
      await writer.query('ROLLBACK');
      await migrator.query('ROLLBACK');
      writer.release();
      migrator.release();
    }
  });
  async function user() {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO users(id,email,display_name,password_hash,updated_at) VALUES ($1,$2,'Regression','unused',now())`,
      [id, `${id}@example.invalid`],
    );
    await new DemoWallet(new Ledger(new PrismaLedgerStore(a))).grant(id);
    return id;
  }
  it('restricted financial roles can post through Prisma without access to fence metadata', async () => {
    const id = await user();
    for (const role of [runtime, worker]) {
      const connection = new URL(databaseUrl);
      connection.searchParams.set('options', `-c role=${role}`);
      const db = createPrismaClient(connection.toString());
      try {
        const service = new DemoBetOperations(new PrismaBetStore(db));
        const input = {
          idempotencyKey: randomUUID(),
          selectionId: 'fbl-north-harbor-result-home',
          stakeMinor: 100n,
        };
        const record = await service.place(id, input);
        expect(record.status).toBe('settled');
        expect(await service.place(id, input)).toEqual(record);
      } finally {
        await db.$disconnect();
      }
    }
  });
  it('temporary tables cannot redirect wallet integrity checks', async () => {
    const ac = await accounts();
    await seed(ac);
    const c = await pool.connect();
    try {
      await c.query(`SET ROLE ${runtime}`);
      await c.query('CREATE TEMP TABLE ledger_entries (LIKE public.ledger_entries)');
      await c.query('CREATE TEMP TABLE ledger_accounts (LIKE public.ledger_accounts)');
      await c.query('BEGIN');
      const id = await header(c);
      await c.query(
        `INSERT INTO public.ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,'DEBIT',101,'FBU'),($4,$2,$5,'CREDIT',101,'FBU')`,
        [randomUUID(), id, ac.wallet, randomUUID(), ac.house],
      );
      await expect(c.query('COMMIT')).rejects.toThrow('insufficient wallet');
      expect(await balance(ac.wallet)).toBe('100');
    } finally {
      await c.query('ROLLBACK');
      await c.query('DROP TABLE IF EXISTS pg_temp.ledger_entries, pg_temp.ledger_accounts');
      await c.query('RESET ROLE');
      c.release();
    }
  });
  it('P1-04 populated legacy upgrade preserves balances and rejects replay after migration', async () => {
    const f = await fixture(2),
      p = f.pool,
      id = randomUUID(),
      key = randomUUID(),
      hold = randomUUID(),
      house = randomUUID(),
      wallet = randomUUID();
    await p.query(
      `INSERT INTO users(id,email,display_name,password_hash,updated_at) VALUES ($1,$2,'Legacy','unused',now())`,
      [id, `${id}@example.invalid`],
    );
    await p.query(
      `INSERT INTO ledger_accounts(id,code,type,currency) VALUES ($1,$2,'USER_WALLET','FBU'),($3,$4,'USER_WALLET','FBU'),($5,'house.demo','HOUSE','FBU')`,
      [wallet, `wallet.${id}`, hold, `wallet.${id}.hold`, house],
    );
    const c = await p.connect();
    try {
      for (const [journalKey, debit, credit, amount] of [
        [`demo-grant-${id}`, house, wallet, 100000],
        [`bet-rsv-${key}`, wallet, hold, 10000],
        [`bet-stl-${key}`, hold, house, 10000],
      ] as const) {
        const tx = randomUUID();
        await c.query('BEGIN');
        await c.query(
          `INSERT INTO ledger_transactions(id,idempotency_key,kind,actor_id) VALUES ($1,$2,$3,$4)`,
          [
            tx,
            journalKey,
            journalKey.startsWith('demo-grant')
              ? 'SIMULATED_ADJUSTMENT'
              : 'SIMULATED_SPORTSBOOK_SETTLEMENT',
            id,
          ],
        );
        await c.query(
          `INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,'DEBIT',$4,'FBU'),($5,$2,$6,'CREDIT',$4,'FBU')`,
          [randomUUID(), tx, debit, amount, randomUUID(), credit],
        );
        await c.query('COMMIT');
      }
    } finally {
      c.release();
    }
    expect(await balance(wallet, p)).toBe('90000');
    await p.query(sql[2]!);
    await p.query(sql[3]!);
    const db = createPrismaClient(f.url);
    try {
      const service = new DemoBetOperations(new PrismaBetStore(db));
      const input = {
        idempotencyKey: key,
        selectionId: 'fbl-north-harbor-result-home',
        stakeMinor: 10000n,
      };
      await expect(service.place(id, input)).rejects.toThrow('Historical bet');
      expect(await balance(wallet, p)).toBe('90000');
      expect(await db.ledgerTransaction.count()).toBe(3);
    } finally {
      await db.$disconnect();
    }
  });
  it('P1-03 lock timeout leaves no partial hardening and retry succeeds', async () => {
    const f = await fixture(3),
      holder = await f.pool.connect(),
      migrator = await f.pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('LOCK TABLE ledger_transactions IN ACCESS SHARE MODE');
      await expect(migrator.query(sql[3]!)).rejects.toMatchObject({ code: '55P03' });
      await migrator.query('ROLLBACK');
      await holder.query('ROLLBACK');
      expect(
        (await f.pool.query("SELECT to_regclass('public.ledger_account_fences') name")).rows[0]
          .name,
      ).toBeNull();
      await migrator.query(sql[3]!);
      expect(
        (await f.pool.query('SELECT public.fable_require_financial_hardening() ok')).rows[0].ok,
      ).toBe(true);
    } finally {
      await holder.query('ROLLBACK');
      await migrator.query('ROLLBACK');
      holder.release();
      migrator.release();
    }
  }, 20000);
  for (const state of [
    'completed',
    'reservation-only',
    'settlement-only',
    'unknown-actor',
    'different-actors',
  ]) {
    it(
      'P1-04 fences ' + state + ' legacy identities, changed payloads and simultaneous retries',
      async () => {
        const id = await user(),
          key = randomUUID(),
          ledger = new Ledger(new PrismaLedgerStore(a));
        // Same legacy-format immutable records as a populated upgrade. No response metadata exists.
        if (state !== 'settlement-only')
          await ledger.post({
            idempotencyKey: `bet-rsv-${key}`,
            kind: 'SIMULATED_SPORTSBOOK_SETTLEMENT',
            actorId: state === 'unknown-actor' ? undefined : id,
            simulated: true,
            lines: reservationLines(id, 10000n),
          });
        if (state === 'settlement-only')
          await ledger.post({
            idempotencyKey: randomUUID(),
            kind: 'SIMULATED_SPORTSBOOK_SETTLEMENT',
            actorId: id,
            simulated: true,
            lines: reservationLines(id, 10000n),
          });
        if (state !== 'reservation-only')
          await ledger.post({
            idempotencyKey: `bet-stl-${key}`,
            kind: 'SIMULATED_SPORTSBOOK_SETTLEMENT',
            actorId: state === 'different-actors' ? randomUUID() : id,
            simulated: true,
            lines: settlementLines(id, 10000n, 0n),
          });
        const wallet = (
          await pool.query('SELECT id FROM ledger_accounts WHERE code=$1', [`wallet.${id}`])
        ).rows[0].id;
        const before = await balance(wallet);
        expect(before).toBe('90000');
        const input = {
          idempotencyKey: key,
          selectionId: 'fbl-north-harbor-result-home',
          stakeMinor: 10000n,
        };
        const results = await Promise.allSettled([
          first.place(id, input),
          second.place(id, input),
          first.place(id, { ...input, stakeMinor: 20000n }),
          second.place(id, { ...input, selectionId: 'fbl-north-harbor-result-away' }),
        ]);
        for (const r of results) {
          expect(r.status).toBe('rejected');
          if (r.status === 'rejected') expect(r.reason.code).toBe('idempotency_conflict');
        }
        // Retry again after losing the rejection response, including a different player sharing the old global identity.
        await expect(second.place(id, input)).rejects.toThrow('Historical bet');
        await expect(first.place(await user(), input)).rejects.toThrow('Historical bet');
        expect(await balance(wallet)).toBe(before);
        expect(await first.list(id)).toHaveLength(0);
        expect(
          await a.ledgerTransaction.count({
            where: { idempotencyKey: { in: [`bet-rsv-${id}-${key}`, `bet-stl-${id}-${key}`] } },
          }),
        ).toBe(0);
      },
    );
  }
});
