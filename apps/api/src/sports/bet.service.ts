import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DemoBetError,
  DemoSportsbook,
  LedgerError,
  deterministicDemoOutcome,
  derivedBalanceMinor,
  potentialPayoutMinor,
  quoteSelection,
  walletAccount,
  type Ledger,
} from '@fable/domain';

import { LEDGER } from '../ledger/ledger.module';

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
  status: 'settled';
  simulated: true;
  realMoney: false;
  createdAt: string;
  note: string;
}

@Injectable()
export class BetService {
  private readonly bets = new Map<string, DemoBetRecord>();
  private readonly tails = new Map<string, Promise<unknown>>();

  constructor(
    @Inject(LEDGER) private readonly ledger: Ledger,
    @Inject(DemoSportsbook) private readonly sportsbook: DemoSportsbook,
  ) {}

  place(
    userId: string,
    input: { idempotencyKey: string; selectionId: string; stakeMinor: bigint },
  ): Promise<DemoBetRecord> {
    return this.lock(userId, () => this.placeLocked(userId, input));
  }

  list(userId: string): DemoBetRecord[] {
    return [...this.bets.values()]
      .filter((bet) => bet.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private async placeLocked(
    userId: string,
    input: { idempotencyKey: string; selectionId: string; stakeMinor: bigint },
  ): Promise<DemoBetRecord> {
    const storageKey = `${userId}:${input.idempotencyKey}`;
    const existing = this.bets.get(storageKey);
    if (existing) return existing;

    const quoted = quoteSelection(input.selectionId);
    if (!quoted) {
      throw new NotFoundException('That selection is not on the demo board.');
    }
    if (quoted.selection.suspended) {
      throw new ConflictException('That demo market is suspended.');
    }

    try {
      const journals = await this.ledger.list();
      const available = derivedBalanceMinor(
        journals.flatMap((journal) => journal.lines),
        walletAccount(userId),
      );
      if (available < input.stakeMinor) {
        throw new BadRequestException('Demo balance does not cover that stake.');
      }
      const outcome = deterministicDemoOutcome(input.selectionId);
      const payoutMinor =
        outcome === 'win'
          ? potentialPayoutMinor(input.stakeMinor, quoted.selection.decimalOdds)
          : 0n;
      const draft = {
        idempotencyKey: input.idempotencyKey,
        userId,
        stakeMinor: input.stakeMinor,
        decimalOdds: quoted.selection.decimalOdds,
        selectionId: input.selectionId,
      };
      await this.sportsbook.reserve(draft);
      await this.sportsbook.settle({ ...draft, payoutMinor });
      const record: DemoBetRecord = {
        id: input.idempotencyKey,
        userId,
        idempotencyKey: input.idempotencyKey,
        eventId: quoted.event.id,
        eventName: quoted.event.name,
        marketName: quoted.market.name,
        selectionId: quoted.selection.id,
        selectionName: quoted.selection.name,
        decimalOdds: quoted.selection.decimalOdds,
        stakeMinor: input.stakeMinor.toString(),
        payoutMinor: payoutMinor.toString(),
        outcome,
        outcomeSource: 'deterministic-demo',
        status: 'settled',
        simulated: true,
        realMoney: false,
        createdAt: new Date().toISOString(),
        note: 'Settled by a fixed rule on the selection id. This is not a sports result.',
      };
      this.bets.set(storageKey, record);
      return record;
    } catch (error) {
      if (error instanceof DemoBetError || error instanceof LedgerError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private lock<T>(userId: string, run: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(userId) ?? Promise.resolve();
    const next = previous.then(run, run);
    this.tails.set(
      userId,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }
}
