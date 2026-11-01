import { Ledger } from '../ledger/ledger';
import type { PostedJournal } from '../ledger/types';
import type { SimulatedSettlementRequest } from '../settlement';

/**
 * Sportsbook boundary.
 * Same rule as casino: settlement is a simulated journal handed to the ledger.
 * There are no markets, odds, or bets in this package.
 */
export class SportsbookBoundary {
  constructor(private readonly ledger: Ledger) {}

  requestSimulatedSettlement(input: SimulatedSettlementRequest): Promise<PostedJournal> {
    return this.ledger.post({
      idempotencyKey: input.idempotencyKey,
      kind: 'SIMULATED_SPORTSBOOK_SETTLEMENT',
      lines: input.lines,
      simulated: true,
      ...(input.actorId ? { actorId: input.actorId } : {}),
    });
  }
}
