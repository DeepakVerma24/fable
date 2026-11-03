import { LedgerError, type Ledger, type BetStore, type DemoBetRecord } from '@fable/domain';
export class MemoryBetStore implements BetStore {
  private rows = new Map<
    string,
    { fingerprint: string; record: DemoBetRecord; placement: DemoBetRecord }
  >();
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly ledger: Ledger) {}
  async list(user: string): Promise<DemoBetRecord[]> {
    return [...this.rows.values()].map((x) => x.record).filter((x) => x.userId === user);
  }
  execute(
    user: string,
    key: string,
    fingerprint: string | null,
    run: (old: DemoBetRecord | null, ledger: Ledger) => Promise<DemoBetRecord>,
  ): Promise<DemoBetRecord> {
    const action = async () => {
      const id = JSON.stringify([user, key]);
      const old = this.rows.get(id);
      if (old && fingerprint !== null && fingerprint !== old.fingerprint)
        throw new LedgerError('idempotency_conflict', 'Bet key was used with a different payload.');
      if (!old && fingerprint === null) throw new LedgerError('missing_bet', 'Bet not found.');
      if (old && fingerprint !== null) return old.placement;
      const record = await run(old?.record ?? null, this.ledger);
      this.rows.set(id, {
        fingerprint: old?.fingerprint ?? fingerprint ?? '',
        record,
        placement: old?.placement ?? record,
      });
      return record;
    };
    const next = this.tail.then(action, action);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
