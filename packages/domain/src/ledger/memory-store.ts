import { randomUUID } from 'node:crypto';

import type { AuditSink } from '../audit/audit';
import { assertSamePayload } from './validate';
import type { PostedJournal, ValidatedJournal } from './types';

export interface LedgerStore {
  /**
   * Persist the journal and its audit record as one unit.
   * A failed audit rolls the journal back. A repeated key returns the original
   * journal and does not write a second audit record.
   */
  postAtomic(journal: ValidatedJournal): Promise<PostedJournal>;

  /** Read committed journals. Balances are derived from these lines. Nothing here updates one. */
  listPosted(): Promise<readonly PostedJournal[]>;
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly byKey = new Map<string, PostedJournal>();
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly audit: AuditSink) {}

  postAtomic(journal: ValidatedJournal): Promise<PostedJournal> {
    const run = this.tail.then(() => this.write(journal));
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async write(journal: ValidatedJournal): Promise<PostedJournal> {
    const existing = this.byKey.get(journal.idempotencyKey);
    if (existing) {
      assertSamePayload(journal, existing);
      return existing;
    }

    const posted: PostedJournal = {
      id: randomUUID(),
      idempotencyKey: journal.idempotencyKey,
      kind: journal.kind,
      simulated: true,
      actorId: journal.actorId,
      lines: journal.lines.map((line) => ({ ...line })),
      postedAt: new Date().toISOString(),
    };
    this.byKey.set(posted.idempotencyKey, posted);
    try {
      await this.audit.record({
        action: 'ledger.journal_posted',
        entityType: 'ledger_transaction',
        entityId: posted.id,
        actorId: posted.actorId,
        metadata: {
          idempotencyKey: posted.idempotencyKey,
          kind: posted.kind,
          simulated: true,
          currency: posted.lines[0]?.currency ?? null,
          lineCount: posted.lines.length,
        },
      });
    } catch (error) {
      this.byKey.delete(posted.idempotencyKey);
      throw error;
    }
    return posted;
  }

  async listPosted(): Promise<readonly PostedJournal[]> {
    return [...this.byKey.values()].sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  }
}
