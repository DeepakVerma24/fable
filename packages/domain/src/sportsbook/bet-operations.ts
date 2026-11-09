import {
  DemoBetError,
  DemoSportsbook,
  LedgerError,
  SportsbookBoundary,
  assertStake,
  deterministicDemoOutcome,
  derivedBalanceMinor,
  potentialPayoutMinor,
  quoteSelection,
  walletAccount,
  type BetStore,
  type DemoBetRecord,
} from '../index';
export class DemoBetOperations {
  constructor(private readonly store: BetStore) {}
  list(userId: string): Promise<DemoBetRecord[]> {
    return this.store.list(userId);
  }
  async place(
    userId: string,
    input: { idempotencyKey: string; selectionId: string; stakeMinor: bigint },
    immediate = true,
  ): Promise<DemoBetRecord> {
    const fingerprint = JSON.stringify([input.selectionId, input.stakeMinor.toString()]);
    try {
      return await this.store.execute(
        userId,
        input.idempotencyKey,
        fingerprint,
        async (old, ledger) => {
          if (old) return old;
          assertStake(input.stakeMinor);
          const quoted = quoteSelection(input.selectionId);
          if (!quoted)
            throw new DemoBetError('not_found', 'That selection is not on the demo board.');
          if (quoted.selection.suspended)
            throw new DemoBetError('conflict', 'That demo market is suspended.');
          const available = derivedBalanceMinor(
            (await ledger.list()).flatMap((j) => j.lines),
            walletAccount(userId),
          );
          if (available < input.stakeMinor)
            throw new DemoBetError('invalid', 'Demo balance does not cover that stake.');
          const outcome = deterministicDemoOutcome(input.selectionId);
          const payoutMinor =
            outcome === 'win'
              ? potentialPayoutMinor(input.stakeMinor, quoted.selection.decimalOdds)
              : 0n;
          const draft = { ...input, userId, decimalOdds: quoted.selection.decimalOdds };
          const sportsbook = new DemoSportsbook(new SportsbookBoundary(ledger));
          await sportsbook.reserve(draft);
          if (immediate) await sportsbook.settle({ ...draft, payoutMinor });
          return {
            id: input.idempotencyKey,
            userId,
            idempotencyKey: input.idempotencyKey,
            eventId: quoted.event.id,
            eventName: quoted.event.name,
            marketName: quoted.market.name,
            selectionId: input.selectionId,
            selectionName: quoted.selection.name,
            decimalOdds: quoted.selection.decimalOdds,
            stakeMinor: input.stakeMinor.toString(),
            payoutMinor: payoutMinor.toString(),
            outcome,
            outcomeSource: 'deterministic-demo',
            status: immediate ? 'settled' : 'accepted',
            simulated: true,
            realMoney: false,
            createdAt: new Date().toISOString(),
            note: 'Settled by a fixed rule on the selection id. This is not a sports result.',
          };
        },
      );
    } catch (error) {
      return this.fail(error);
    }
  }
  /** Internal lifecycle operations: no unauthenticated or operator mutation endpoint. */
  async transition(
    userId: string,
    key: string,
    action: 'settled' | 'cancelled' | 'refunded',
  ): Promise<DemoBetRecord> {
    try {
      return await this.store.execute(userId, key, null, async (old, ledger) => {
        if (!old) throw new DemoBetError('not_found', 'Bet not found.');
        if (old.status === action) return old;
        const sportsbook = new DemoSportsbook(new SportsbookBoundary(ledger));
        const draft = {
          userId,
          idempotencyKey: key,
          selectionId: old.selectionId,
          decimalOdds: old.decimalOdds,
          stakeMinor: BigInt(old.stakeMinor),
        };
        if (old.status === 'accepted' && (action === 'settled' || action === 'cancelled')) {
          await sportsbook.settle({
            ...draft,
            payoutMinor: action === 'cancelled' ? draft.stakeMinor : BigInt(old.payoutMinor),
          });
        } else if (old.status === 'settled' && action === 'refunded') {
          const journals = (await ledger.list()).filter(
            (j) =>
              j.idempotencyKey === `bet-rsv-${userId}-${key}` ||
              j.idempotencyKey === `bet-stl-${userId}-${key}`,
          );
          if (journals.length !== 2)
            throw new LedgerError('missing_journals', 'Cannot refund an incomplete journal pair.');
          await ledger.post({
            idempotencyKey: `bet-ref-${userId}-${key}`,
            kind: 'SIMULATED_SPORTSBOOK_SETTLEMENT',
            actorId: userId,
            simulated: true,
            lines: journals
              .flatMap((j) => j.lines)
              .map((l) => ({ ...l, direction: l.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT' })),
          });
        } else throw new DemoBetError('conflict', 'Invalid bet transition.');
        return { ...old, status: action };
      });
    } catch (error) {
      return this.fail(error);
    }
  }
  private fail(error: unknown): never {
    throw error;
  }
}
