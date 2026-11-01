import { randomUUID } from 'node:crypto';

import {
  LedgerError,
  accountTypeForCode,
  assertSamePayload,
  type LedgerStore,
  type PostedJournal,
  type ValidatedJournal,
} from '@fable/domain';

import type { PrismaClient } from './generated/prisma/client';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Postgres implementation of the ledger store.
 * The journal, its lines, and the audit row commit in one transaction.
 * A unique idempotency key collision re-reads and replays the original journal.
 */
export class PrismaLedgerStore implements LedgerStore {
  constructor(private readonly prisma: PrismaClient) {}

  async postAtomic(journal: ValidatedJournal): Promise<PostedJournal> {
    try {
      return await this.prisma.$transaction((tx) => this.write(tx, journal));
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const existing = await this.prisma.ledgerTransaction.findUnique({
        where: { idempotencyKey: journal.idempotencyKey },
        include: { entries: { include: { account: true } } },
      });
      if (!existing) throw error;
      const posted = mapPosted(existing);
      assertSamePayload(journal, posted);
      return posted;
    }
  }

  private async write(tx: Tx, journal: ValidatedJournal): Promise<PostedJournal> {
    const existing = await tx.ledgerTransaction.findUnique({
      where: { idempotencyKey: journal.idempotencyKey },
      include: { entries: { include: { account: true } } },
    });
    if (existing) {
      const posted = mapPosted(existing);
      assertSamePayload(journal, posted);
      return posted;
    }

    const accountIds = new Map<string, string>();
    for (const line of journal.lines) {
      if (accountIds.has(line.accountCode)) continue;
      const accountId = await ensureAccount(tx, line.accountCode, line.currency);
      accountIds.set(line.accountCode, accountId);
    }

    const id = randomUUID();
    const created = await tx.ledgerTransaction.create({
      data: {
        id,
        idempotencyKey: journal.idempotencyKey,
        kind: journal.kind,
        actorId: journal.actorId,
        simulated: true,
        entries: {
          create: journal.lines.map((line) => {
            const accountId = accountIds.get(line.accountCode);
            if (!accountId) {
              throw new LedgerError('account', `Account ${line.accountCode} was not created.`);
            }
            return {
              id: randomUUID(),
              accountId,
              direction: line.direction,
              amountMinor: line.amountMinor,
              currency: line.currency,
            };
          }),
        },
      },
      include: { entries: { include: { account: true } } },
    });

    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: journal.actorId,
        action: 'ledger.journal_posted',
        entityType: 'ledger_transaction',
        entityId: id,
        metadata: {
          idempotencyKey: journal.idempotencyKey,
          kind: journal.kind,
          simulated: true,
          currency: journal.lines[0]?.currency ?? null,
          lineCount: journal.lines.length,
        },
      },
    });

    return mapPosted(created);
  }
}

async function ensureAccount(tx: Tx, code: string, currency: string): Promise<string> {
  const existing = await tx.ledgerAccount.findUnique({ where: { code } });
  if (existing) {
    if (existing.currency !== currency) {
      throw new LedgerError(
        'currency',
        `Account ${code} is ${existing.currency.trim()} and cannot post ${currency}.`,
      );
    }
    return existing.id;
  }
  const created = await tx.ledgerAccount.create({
    data: {
      id: randomUUID(),
      code,
      type: accountTypeForCode(code),
      currency,
    },
  });
  return created.id;
}

type StoredTransaction = {
  id: string;
  idempotencyKey: string;
  kind: string;
  actorId: string | null;
  entries: readonly {
    direction: 'DEBIT' | 'CREDIT';
    amountMinor: bigint;
    currency: string;
    account: { code: string };
  }[];
};

function mapPosted(row: StoredTransaction): PostedJournal {
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    kind: row.kind as PostedJournal['kind'],
    simulated: true,
    actorId: row.actorId,
    lines: row.entries.map((entry) => ({
      accountCode: entry.account.code,
      direction: entry.direction,
      amountMinor: entry.amountMinor,
      currency: entry.currency.trim(),
    })),
  };
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
