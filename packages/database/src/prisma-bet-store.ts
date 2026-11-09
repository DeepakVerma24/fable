import { randomUUID } from 'node:crypto';
import { Ledger, LedgerError, type BetStore, type DemoBetRecord } from '@fable/domain';
import type { PrismaClient } from './generated/prisma/client';
import { PrismaLedgerStore, retryFinancial } from './prisma-ledger-store';

/** No remote effects inside the retryable unit of work. The response commits with its journals. */
export class PrismaBetStore implements BetStore {
  constructor(private readonly prisma: PrismaClient) {}
  async list(userId: string): Promise<DemoBetRecord[]> {
    const rows = await this.prisma.$queryRaw<
      { record: DemoBetRecord }[]
    >`SELECT record FROM demo_bets WHERE user_id = ${userId}::uuid ORDER BY record->>'createdAt' DESC`;
    return rows.map((row) => row.record);
  }
  execute(
    userId: string,
    key: string,
    fingerprint: string | null,
    run: (previous: DemoBetRecord | null, ledger: Ledger) => Promise<DemoBetRecord>,
  ): Promise<DemoBetRecord> {
    return retryFinancial(() =>
      this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT public.fable_require_financial_hardening()`;
          // All operations for this wallet, including different idempotency keys, share this DB lock.
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`bet-user:${userId}`}, 0))`;
          const rows = await tx.$queryRaw<
            { record: DemoBetRecord; placement_record: DemoBetRecord; fingerprint: string }[]
          >`SELECT record, placement_record, fingerprint FROM demo_bets WHERE user_id = ${userId}::uuid AND idempotency_key = ${key} FOR UPDATE`;
          const old = rows[0];
          if (old && fingerprint !== null && fingerprint !== old.fingerprint)
            throw new LedgerError(
              'idempotency_conflict',
              'Bet key was used with a different payload.',
            );
          if (!old && fingerprint === null) throw new LedgerError('missing_bet', 'Bet not found.');
          if (old && fingerprint !== null) return old.placement_record;
          // Legacy metadata was process-local. Its immutable journal identity is
          // durable, but cannot prove selection/odds or reconstruct a response.
          // Fence globally: missing/mismatched actors and partial pairs are ambiguous.
          if (!old && fingerprint !== null) {
            const legacy = await tx.ledgerTransaction.findFirst({
              where: { idempotencyKey: { in: [`bet-rsv-${key}`, `bet-stl-${key}`] } },
              select: { id: true },
            });
            if (legacy)
              throw new LedgerError(
                'idempotency_conflict',
                'Historical bet identity requires reconciliation; no new bet was placed.',
              );
          }
          const base = new PrismaLedgerStore(this.prisma);
          const ledger = new Ledger({
            postAtomic: (journal) => base.write(tx, journal),
            listPosted: async () => {
              // Reuse the same transaction for authoritative reads.
              const store = new PrismaLedgerStore(tx as unknown as PrismaClient);
              return store.listPosted();
            },
          });
          const record = await run(old?.record ?? null, ledger);
          const json = JSON.stringify(record);
          if (old) {
            await tx.$executeRaw`UPDATE demo_bets SET record = ${json}::jsonb WHERE user_id = ${userId}::uuid AND idempotency_key = ${key}`;
          } else {
            await tx.$executeRaw`INSERT INTO demo_bets(user_id,idempotency_key,fingerprint,record,placement_record) VALUES (${userId}::uuid,${key},${fingerprint},${json}::jsonb,${json}::jsonb)`;
          }
          if (!old || old.record.status !== record.status)
            await tx.auditLog.create({
              data: {
                id: randomUUID(),
                actorId: userId,
                action: `demo_bet.${record.status}`,
                entityType: 'demo_bet',
                entityId: `${userId}:${key}`,
                metadata: { simulated: true },
              },
            });
          return record;
        },
        { isolationLevel: 'Serializable', maxWait: 10000, timeout: 15000 },
      ),
    );
  }
}
