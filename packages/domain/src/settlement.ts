import type { JournalLine } from './ledger/types';

/** Shared shape for a simulated settlement request. Neither product module owns balances. */
export interface SimulatedSettlementRequest {
  idempotencyKey: string;
  lines: readonly JournalLine[];
  actorId?: string;
}
