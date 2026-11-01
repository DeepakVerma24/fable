import type { LedgerStore } from './memory-store';
import type { JournalDraft, PostedJournal } from './types';
import { validateJournal } from './validate';

/**
 * The only balance authority in the process.
 * Casino, sportsbook, providers, and workers call this. They do not write entries.
 */
export class Ledger {
  constructor(private readonly store: LedgerStore) {}

  async post(draft: JournalDraft): Promise<PostedJournal> {
    return this.store.postAtomic(validateJournal(draft));
  }

  /** Committed journals, oldest first. Callers derive balances. They do not write them back. */
  list(): Promise<readonly PostedJournal[]> {
    return this.store.listPosted();
  }
}
