import type { Ledger } from '../ledger/ledger';
export interface DemoBetRecord {
  id: string;
  userId: string;
  idempotencyKey: string;
  eventId: string;
  eventName: string;
  marketName: string;
  selectionId: string;
  selectionName: string;
  decimalOdds: string;
  stakeMinor: string;
  payoutMinor: string;
  outcome: 'win' | 'loss';
  outcomeSource: 'deterministic-demo';
  status: 'accepted' | 'settled' | 'cancelled' | 'refunded';
  simulated: true;
  realMoney: false;
  createdAt: string;
  note: string;
}

export interface BetStore {
  execute(
    userId: string,
    key: string,
    fingerprint: string | null,
    run: (previous: DemoBetRecord | null, ledger: Ledger) => Promise<DemoBetRecord>,
  ): Promise<DemoBetRecord>;
  list(userId: string): Promise<DemoBetRecord[]>;
}
