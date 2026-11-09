/** Nonfinancial originals. No ledger, wallet, stakes or settlement dependencies. */
export type OriginalKind = 'dice' | 'mines' | 'plinko' | 'limbo';
export const ORIGINAL_GAMES = [
  {
    id: 'paper-dice',
    kind: 'dice',
    name: 'Paper Dice',
    summary: 'Choose a chance and roll a server-generated number below the threshold.',
    rules: [
      'Choose an integer win chance from 5% to 95%. The server draws an integer from 0 to 9,999, displayed as 0.00 to 99.99. A roll strictly below chance × 100 is a hit.',
      'On a hit, multiplier = floor(990000 / chance) / 10000. Practice return = floor(100 × multiplier); a miss returns 0 practice points.',
    ],
  },
  {
    id: 'fable-mines',
    kind: 'mines',
    name: 'Fable Mines',
    summary: 'Explore a 25-cell board and finish before uncovering a mine.',
    rules: [
      'Choose 1 to 10 mines. The server samples distinct mine positions on a 25-cell board. Reveal cells one at a time; a mine ends the round with 0 practice points.',
      'After k safe reveals, multiplier = floor(9900 × C(25,k) / C(25 − mines,k)) / 10000. Finish after at least one safe reveal to record floor(100 × multiplier) practice points. Revealing every safe cell finishes automatically.',
      'The active board stays on the server. Mine locations are disclosed only after the round ends. Only one unfinished Mines round per player is allowed.',
    ],
  },
  {
    id: 'fable-plinko',
    kind: 'plinko',
    name: 'Fable Plinko',
    summary: 'Follow eight server-generated left or right steps to a practice multiplier.',
    rules: [
      'The server generates eight independent left/right steps. The number of right steps identifies one of nine buckets, indexed 0 to 8.',
      'Bucket multipliers: 5×, 2×, 1×, 0.50×, 0.20×, 0.50×, 1×, 2×, 5×. Practice return = floor(100 × the bucket multiplier). There is no selectable risk setting.',
    ],
  },
  {
    id: 'fable-limbo',
    kind: 'limbo',
    name: 'Fable Limbo',
    summary: 'Choose a target multiplier and reveal a server-generated result.',
    rules: [
      'Choose an integer target from 2× to 100×. The server draws r uniformly from 1 to 1,000,000. The displayed result is max(1, min(100, floor(99000000 / r) / 100)).',
      'A displayed result at or above the target returns 100 × target practice points; otherwise the return is 0. Only the chosen target determines the practice return.',
    ],
  },
] as const;
export const PLINKO_MULTIPLIERS = [
  50000, 20000, 10000, 5000, 2000, 5000, 10000, 20000, 50000,
] as const;
export const PRACTICE_POINTS = 100;
export interface OriginalOptions {
  chance?: number;
  mines?: number;
  target?: number;
}
export interface OriginalRound {
  id: string;
  gameId: string;
  kind: OriginalKind;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  stateSchemaVersion: 1;
  status: 'active' | 'complete';
  version: number;
  outcome: 'in-progress' | 'hit' | 'miss' | 'mine' | 'finished' | 'complete';
  simulated: true;
  financial: false;
  realMoney: false;
  referencePoints: 100;
  multiplierBps: number;
  returnPoints: number;
  dice?: { rollHundredths: number; chance: number };
  mines?: { mineCount: number; revealed: number[]; locations?: number[] };
  plinko?: { path: number[]; bucket: number };
  limbo?: { reachedHundredths: number; target: number };
}
export interface StartOriginal {
  sessionId: string;
  idempotencyKey: string;
  gameId: string;
  options: OriginalOptions;
}
export interface OriginalAction {
  sessionId: string;
  idempotencyKey: string;
  expectedVersion: number;
  type: 'reveal' | 'finish';
  cell?: number;
}
export class OriginalError extends Error {
  constructor(
    readonly code: 'invalid' | 'conflict' | 'not_found' | 'session_changed' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}
export function minesMultiplier(mineCount: number, safeReveals: number): number {
  if (safeReveals === 0) return 10000;
  let numerator = 9900n;
  let denominator = 1n;
  for (let i = 0; i < safeReveals; i++) {
    numerator *= BigInt(25 - i);
    denominator *= BigInt(25 - mineCount - i);
  }
  return Number(numerator / denominator);
}
export interface StoredOriginalRound {
  public: OriginalRound;
  /** Never send private mine positions to a client. */
  mines: number[];
}
/** Stateless rules. Database transactions own player isolation and command replay. */
export class OriginalRules {
  constructor(
    private readonly randomInt: (exclusiveMax: number) => number,
    private readonly makeId: () => string,
  ) {}
  private draw(max: number): number {
    const value = this.randomInt(max);
    if (!Number.isSafeInteger(value) || value < 0 || value >= max)
      throw new Error('Random source returned an invalid value.');
    return value;
  }
  create(input: StartOriginal, now: string): StoredOriginalRound {
    const options = input.options;
    const game = ORIGINAL_GAMES.find((game) => game.id === input.gameId);
    if (!game)
      throw new OriginalError('not_found', 'This title has no simulated game implementation.');
    const allowed =
      game.kind === 'dice'
        ? 'chance'
        : game.kind === 'mines'
          ? 'mines'
          : game.kind === 'limbo'
            ? 'target'
            : null;
    for (const [key, value] of Object.entries(options))
      if (value !== undefined && key !== allowed)
        throw new OriginalError('invalid', 'Unsupported settings for this game.');
    const round: OriginalRound = {
      id: this.makeId(),
      gameId: game.id,
      kind: game.kind,
      sessionId: input.sessionId,
      createdAt: now,
      updatedAt: now,
      stateSchemaVersion: 1,
      status: 'complete',
      version: 0,
      outcome: 'complete',
      simulated: true,
      financial: false,
      realMoney: false,
      referencePoints: 100,
      multiplierBps: 0,
      returnPoints: 0,
    };
    const stored: StoredOriginalRound = { public: round, mines: [] };
    if (game.kind === 'dice') {
      const chance = integer(options.chance ?? 50, 5, 95);
      const rollHundredths = this.draw(10000);
      const hit = rollHundredths < chance * 100;
      round.dice = { chance, rollHundredths };
      round.outcome = hit ? 'hit' : 'miss';
      round.multiplierBps = hit ? Math.floor(990000 / chance) : 0;
    } else if (game.kind === 'limbo') {
      const target = integer(options.target ?? 2, 2, 100);
      const reachedHundredths = Math.max(
        100,
        Math.min(10000, Math.floor(99000000 / (this.draw(1_000_000) + 1))),
      );
      const hit = reachedHundredths >= target * 100;
      round.limbo = { target, reachedHundredths };
      round.outcome = hit ? 'hit' : 'miss';
      round.multiplierBps = hit ? target * 10000 : 0;
    } else if (game.kind === 'plinko') {
      const path = Array.from({ length: 8 }, () => this.draw(2));
      const bucket = path.reduce((sum, value) => sum + value, 0);
      round.plinko = { path, bucket };
      round.multiplierBps = PLINKO_MULTIPLIERS[bucket]!;
    } else {
      const mineCount = integer(options.mines ?? 3, 1, 10);
      const cells = Array.from({ length: 25 }, (_, i) => i);
      for (let i = 0; i < mineCount; i++) {
        const j = i + this.draw(25 - i);
        [cells[i], cells[j]] = [cells[j]!, cells[i]!];
      }
      stored.mines = cells.slice(0, mineCount);
      round.mines = { mineCount, revealed: [] };
      round.status = 'active';
      round.outcome = 'in-progress';
      round.multiplierBps = 10000;
    }
    round.returnPoints = Math.floor((PRACTICE_POINTS * round.multiplierBps) / 10000);
    return stored;
  }
  advance(previous: StoredOriginalRound, input: OriginalAction, now: string): StoredOriginalRound {
    const stored = structuredClone(previous);
    const current = stored.public;
    if (current.status !== 'active' || !current.mines)
      throw new OriginalError('conflict', 'This round is already complete.');
    if (current.version !== input.expectedVersion)
      throw new OriginalError(
        'conflict',
        'The round changed in another tab. Refresh before acting again.',
      );
    if (input.type !== 'reveal' && input.type !== 'finish')
      throw new OriginalError('invalid', 'Unsupported Mines action.');
    if (input.type === 'finish') {
      if (input.cell !== undefined)
        throw new OriginalError('invalid', 'Finish does not accept a cell.');
      if (current.mines.revealed.length === 0)
        throw new OriginalError('invalid', 'Reveal at least one cell before finishing.');
      current.status = 'complete';
      current.outcome = 'finished';
    } else {
      const cell = integer(input.cell, 0, 24);
      if (current.mines.revealed.includes(cell))
        throw new OriginalError('conflict', 'This cell is already revealed.');
      current.mines.revealed.push(cell);
      if (stored.mines.includes(cell)) {
        current.status = 'complete';
        current.outcome = 'mine';
        current.multiplierBps = 0;
      } else {
        current.multiplierBps = minesMultiplier(
          current.mines.mineCount,
          current.mines.revealed.length,
        );
        if (current.mines.revealed.length === 25 - current.mines.mineCount) {
          current.status = 'complete';
          current.outcome = 'finished';
        }
      }
    }
    current.returnPoints = Math.floor((PRACTICE_POINTS * current.multiplierBps) / 10000);
    if (current.status === 'complete') current.mines.locations = [...stored.mines];
    current.version += 1;
    current.updatedAt = now;
    return stored;
  }
}
function integer(value: number | undefined, min: number, max: number): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < min || value > max)
    throw new OriginalError('invalid', `Setting must be an integer between ${min} and ${max}.`);
  return value;
}
