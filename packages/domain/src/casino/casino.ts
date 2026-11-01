import { Ledger } from '../ledger/ledger';
import type { PostedJournal } from '../ledger/types';
import type { SimulatedSettlementRequest } from '../settlement';

/**
 * Casino boundary.
 * This module submits a simulated journal. It has no method that changes a balance,
 * and it cannot mark a journal as real money. There is no game implementation here.
 */
export class CasinoBoundary {
  constructor(private readonly ledger: Ledger) {}

  requestSimulatedSettlement(input: SimulatedSettlementRequest): Promise<PostedJournal> {
    return this.ledger.post({
      idempotencyKey: input.idempotencyKey,
      kind: 'SIMULATED_CASINO_SETTLEMENT',
      lines: input.lines,
      simulated: true,
      ...(input.actorId ? { actorId: input.actorId } : {}),
    });
  }
}
