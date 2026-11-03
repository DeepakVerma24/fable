import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Ledger, DemoWallet, walletAccount, derivedBalanceMinor } from '@fable/domain';
import { createPrismaClient } from './prisma';
import { retryFinancial, PrismaLedgerStore } from './prisma-ledger-store';
import { PrismaBetStore } from './prisma-bet-store';
import { DemoBetOperations as BetService } from '@fable/domain';

const url = process.env.FABLE_POSTGRES_TEST_URL;
const legacyTransaction = randomUUID(),
  legacyAccount = randomUUID();
describe.skipIf(!url)('real PostgreSQL financial invariants', () => {
  const pool = new Pool({ connectionString: url });
  const a = createPrismaClient(url!);
  const b = createPrismaClient(url!);
  const first = new BetService(new PrismaBetStore(a));
  const second = new BetService(new PrismaBetStore(b));
  const ledger = new Ledger(new PrismaLedgerStore(a));
  const input = (key = randomUUID()) => ({
    idempotencyKey: key,
    selectionId: 'fbl-north-harbor-result-home',
    stakeMinor: 50000n,
  });
  beforeAll(async () => {
    // Dedicated empty database only. Never target production or a shared application database.
    const existing = await pool.query("SELECT to_regclass('public.users') AS name");
    if (existing.rows[0].name)
      throw new Error('Financial tests require an empty dedicated database');
    for (const migration of [
      '20261101120000_init',
      '20261101183000_player_auth',
      '20261103020000_financial_integrity',
      '20261103140000_financial_hardening',
    ]) {
      if (migration === '20261103020000_financial_integrity') {
        await pool.query(
          `BEGIN; INSERT INTO ledger_accounts(id,code,type,currency) VALUES ('${legacyAccount}','legacy','SYSTEM','FBU'); INSERT INTO ledger_transactions(id,idempotency_key,kind,simulated) VALUES ('${legacyTransaction}','legacy-journal','SIMULATED_ADJUSTMENT',true); INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ('${randomUUID()}','${legacyTransaction}','${legacyAccount}','DEBIT',1,'FBU'),('${randomUUID()}','${legacyTransaction}','${legacyAccount}','CREDIT',1,'FBU'); COMMIT;`,
        );
      }
      if (migration === '20261103020000_financial_integrity') {
        const c = await pool.connect();
        try {
          await c.query(
            `INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ('${randomUUID()}','${legacyTransaction}','${legacyAccount}','CREDIT',1,'FBU')`,
          );
          const sql = readFileSync(
            path.join(process.cwd(), 'prisma/migrations', migration, 'migration.sql'),
            'utf8',
          );
          await expect(c.query(sql)).rejects.toThrow('historical journal imbalance');
          await c.query('ROLLBACK');
          expect(
            (await c.query("SELECT to_regclass('public.demo_bets') AS name")).rows[0].name,
          ).toBeNull();
          await c.query(
            `INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ('${randomUUID()}','${legacyTransaction}','${legacyAccount}','DEBIT',1,'FBU')`,
          );
        } finally {
          c.release();
        }
      }
      await pool.query(
        readFileSync(
          path.join(process.cwd(), 'prisma/migrations', migration, 'migration.sql'),
          'utf8',
        ).replace(/^\uFEFF/, ''),
      );
    }
  }, 30000);
  it('seals historical populated journals during upgrade', async () => {
    await expect(
      pool.query(
        'INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,$4,1,$5)',
        [randomUUID(), legacyTransaction, legacyAccount, 'CREDIT', 'FBU'],
      ),
    ).rejects.toThrow('sealed');
  });
  it('rolls back an immediate placement when ledger audit insertion fails', async () => {
    const id = await user();
    const draft = input();
    await pool.query(
      `CREATE FUNCTION fail_placement_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_id='${id}' AND NEW.action='ledger.journal_posted' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_placement_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_placement_audit();`,
    );
    try {
      await expect(first.place(id, draft)).rejects.toThrow();
      expect(await first.list(id)).toHaveLength(0);
      expect(await balance(id)).toBe(100000n);
    } finally {
      await pool.query(
        'DROP TRIGGER fail_placement_audit ON audit_log; DROP FUNCTION fail_placement_audit();',
      );
    }
    await second.place(id, draft);
    expect(await balance(id)).toBe(50000n);
  });
  it('retries a real PostgreSQL deadlock without duplicate committed effects', async () => {
    let arrivals = 0,
      attempts = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prefix = randomUUID();
    const run = (client: typeof a, firstLock: number, secondLock: number) =>
      retryFinancial(() =>
        client.$transaction(
          async (tx) => {
            attempts++;
            await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${firstLock}::bigint)`;
            if (arrivals < 2) {
              arrivals++;
              if (arrivals === 2) release();
              await gate;
            }
            await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${secondLock}::bigint)`;
            await tx.auditLog.create({
              data: {
                id: randomUUID(),
                action: prefix,
                entityType: 'deadlock_test',
                entityId: prefix,
                metadata: { simulated: true },
              },
            });
          },
          { timeout: 15000 },
        ),
      );
    await Promise.all([run(a, 701, 702), run(b, 702, 701)]);
    expect(attempts).toBeGreaterThan(2);
    expect(await a.auditLog.count({ where: { action: prefix } })).toBe(2);
  }, 30000);
  it('database rejects a balanced journal that overdraws a wallet', async () => {
    const id = await user();
    await expect(
      ledger.post({
        idempotencyKey: randomUUID(),
        kind: 'SIMULATED_ADJUSTMENT',
        actorId: id,
        simulated: true,
        lines: [
          {
            accountCode: walletAccount(id),
            direction: 'DEBIT',
            amountMinor: 200000n,
            currency: 'FBU',
          },
          { accountCode: 'house.demo', direction: 'CREDIT', amountMinor: 200000n, currency: 'FBU' },
        ],
      }),
    ).rejects.toThrow();
    expect(await balance(id)).toBe(100000n);
  });
  afterAll(async () => {
    await a.$disconnect();
    await b.$disconnect();
    await pool.end();
  });
  async function user() {
    const id = randomUUID();
    await pool.query(
      'INSERT INTO users(id,email,display_name,password_hash,updated_at) VALUES ($1,$2,$3,$4,now())',
      [id, `${id}@example.invalid`, 'Integration', 'unused'],
    );
    await new DemoWallet(ledger).grant(id);
    return id;
  }
  async function balance(id: string) {
    return derivedBalanceMinor(
      (await ledger.list()).flatMap((j) => j.lines),
      walletAccount(id),
    );
  }
  it('seals committed journals, rejects currency changes and rolls back unbalanced journals', async () => {
    const id = await user();
    const row = await pool.query(
      'SELECT e.transaction_id,e.account_id FROM ledger_entries e JOIN ledger_transactions t ON t.id=e.transaction_id WHERE t.actor_id=$1 LIMIT 1',
      [id],
    );
    await expect(
      pool.query(
        'INSERT INTO ledger_entries(id,transaction_id,account_id,direction,amount_minor,currency) VALUES ($1,$2,$3,$4,1,$5)',
        [randomUUID(), row.rows[0].transaction_id, row.rows[0].account_id, 'CREDIT', 'FBU'],
      ),
    ).rejects.toThrow('sealed');
    await expect(
      pool.query("UPDATE ledger_accounts SET currency='USD' WHERE id=$1", [row.rows[0].account_id]),
    ).rejects.toThrow('append-only');
    await expect(
      pool.query(
        "INSERT INTO ledger_transactions(id,idempotency_key,kind,simulated) VALUES ($1,$2,'SIMULATED_ADJUSTMENT',true)",
        [randomUUID(), randomUUID()],
      ),
    ).rejects.toThrow('balanced');
    expect(await balance(id)).toBe(100000n);
  });
  it('serializes spending across independent clients and prevents overdraft', async () => {
    const id = await user();
    const results = await Promise.allSettled([
      first.place(id, input(), false),
      second.place(id, input(), false),
      first.place(id, input(), false),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await balance(id)).toBe(0n);
  });
  it('persists concurrent replays, isolates players and rejects changed payloads', async () => {
    const id = await user();
    const other = await user();
    const draft = input();
    const results = await Promise.all([first.place(id, draft), second.place(id, draft)]);
    expect(results[0]).toEqual(results[1]);
    await expect(second.place(id, { ...draft, stakeMinor: 100n })).rejects.toThrow(
      'different payload',
    );
    await expect(second.place(other, draft)).resolves.toHaveProperty('userId', other);
    expect(await new BetService(new PrismaBetStore(b)).list(id)).toHaveLength(1);
    expect(await balance(id)).toBe(50000n);
  });
  it('settles once, cancels holds, refunds once, and rejects invalid transitions', async () => {
    const id = await user();
    const draft = input();
    await first.place(id, draft, false);
    await Promise.all([
      first.transition(id, draft.idempotencyKey, 'settled'),
      second.transition(id, draft.idempotencyKey, 'settled'),
    ]);
    expect(await balance(id)).toBe(50000n);
    await first.transition(id, draft.idempotencyKey, 'refunded');
    await second.transition(id, draft.idempotencyKey, 'refunded');
    expect((await second.place(id, draft, false)).status).toBe('accepted');
    expect((await first.list(id))[0]?.status).toBe('refunded');
    expect(await balance(id)).toBe(100000n);
    await expect(first.transition(id, draft.idempotencyKey, 'settled')).rejects.toThrow('Invalid');
    const cancel = input();
    await first.place(id, cancel, false);
    await second.transition(id, cancel.idempotencyKey, 'cancelled');
    expect(await balance(id)).toBe(100000n);
  });
  it('rolls back journal and bet state on audit failure and safely retries settlement', async () => {
    const id = await user();
    const draft = input();
    await first.place(id, draft, false);
    await pool.query(
      `CREATE FUNCTION fail_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_id='${id}' AND NEW.action='demo_bet.settled' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_test_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_test_audit();`,
    );
    try {
      await expect(first.transition(id, draft.idempotencyKey, 'settled')).rejects.toThrow();
      expect((await first.list(id))[0]?.status).toBe('accepted');
      expect(await balance(id)).toBe(50000n);
    } finally {
      await pool.query(
        'DROP TRIGGER fail_test_audit ON audit_log; DROP FUNCTION fail_test_audit();',
      );
    }
    await second.transition(id, draft.idempotencyKey, 'settled');
    expect(await balance(id)).toBe(50000n);
    const lines = await pool.query(
      'SELECT count(*) FROM ledger_transactions WHERE idempotency_key=$1',
      [`bet-stl-${id}-${draft.idempotencyKey}`],
    );
    expect(lines.rows[0].count).toBe('1');
  });
});
