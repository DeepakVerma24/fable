import { describe, expect, it } from 'vitest';
import {
  OriginalRules,
  minesMultiplier,
  type OriginalOptions,
  type OriginalAction,
} from './originals';

const now = '2026-11-05T10:00:00.000Z',
  later = '2026-11-05T10:01:00.000Z';
function rules(values: number[] = []) {
  return new OriginalRules(
    (max) => (values.shift() ?? 0) % max,
    () => 'round-id',
  );
}
const start = (gameId: string, options: OriginalOptions = {}) => ({
  sessionId: 'database-id',
  idempotencyKey: 'start-key',
  gameId,
  options,
});
const reveal = (expectedVersion: number, cell: number): OriginalAction => ({
  sessionId: 'database-id',
  idempotencyKey: 'action-key',
  expectedVersion,
  type: 'reveal',
  cell,
});

describe('stateless nonfinancial Originals', () => {
  it('keeps Dice strict at the threshold and uses integer point calculations', () => {
    const r = rules([4999, 5000]);
    expect(r.create(start('paper-dice', { chance: 50 }), now).public).toMatchObject({
      outcome: 'hit',
      returnPoints: 198,
      financial: false,
      realMoney: false,
    });
    expect(r.create(start('paper-dice', { chance: 50 }), now).public.outcome).toBe('miss');
  });
  it('derives Plinko buckets from eight independent steps', () => {
    expect(rules([0, 1, 0, 1, 1, 0, 0, 1]).create(start('fable-plinko'), now).public).toMatchObject(
      { plinko: { path: [0, 1, 0, 1, 1, 0, 0, 1], bucket: 4 }, returnPoints: 20 },
    );
    expect(rules().create(start('fable-plinko'), now).public.returnPoints).toBe(500);
  });
  it('uses the inclusive Limbo threshold and caps its displayed result', () => {
    expect(rules([494999]).create(start('fable-limbo', { target: 2 }), now).public).toMatchObject({
      limbo: { reachedHundredths: 200 },
      returnPoints: 200,
    });
    expect(rules([495000]).create(start('fable-limbo'), now).public.outcome).toBe('miss');
    expect(
      rules().create(start('fable-limbo', { target: 100 }), now).public.limbo?.reachedHundredths,
    ).toBe(10000);
  });
  it('resumes a serialized private board with a different rules instance without mutating its input', () => {
    const initial = rules().create(start('fable-mines', { mines: 3 }), now);
    const restored = JSON.parse(JSON.stringify(initial)) as typeof initial;
    const restarted = new OriginalRules(
      () => {
        throw new Error('An existing board must never redraw');
      },
      () => 'unused',
    );
    const safe = restarted.advance(restored, reveal(0, 24), later);
    expect(initial.public.mines?.revealed).toEqual([]);
    expect(safe.public).toMatchObject({
      version: 1,
      createdAt: now,
      updatedAt: later,
      returnPoints: 112,
    });
    expect(safe.public.mines?.locations).toBeUndefined();
    const finished = restarted.advance(
      safe,
      { ...reveal(1, 24), type: 'finish', cell: undefined },
      later,
    );
    expect(finished.public).toMatchObject({
      outcome: 'finished',
      version: 2,
      mines: { locations: [0, 1, 2] },
    });
  });
  it('rejects stale versions, repeated cells, premature finish and further terminal actions', () => {
    const r = rules(),
      initial = r.create(start('fable-mines'), now);
    expect(() =>
      r.advance(initial, { ...reveal(0, 0), type: 'finish', cell: undefined }, later),
    ).toThrow('at least one');
    const safe = r.advance(initial, reveal(0, 24), later);
    expect(() => r.advance(safe, reveal(0, 23), later)).toThrow('another tab');
    expect(() => r.advance(safe, reveal(1, 24), later)).toThrow('already revealed');
    const loss = r.advance(safe, reveal(1, 0), later);
    expect(loss.public).toMatchObject({ outcome: 'mine', returnPoints: 0, version: 2 });
    expect(() => r.advance(loss, reveal(2, 10), later)).toThrow('already complete');
  });
  it('auto-finishes all safe cells using exact combinatorial arithmetic', () => {
    const r = rules();
    let state = r.create(start('fable-mines', { mines: 10 }), now);
    for (let cell = 10; cell < 25; cell++)
      state = r.advance(state, reveal(state.public.version, cell), later);
    expect(state.public.status).toBe('complete');
    expect(state.public.returnPoints).toBe(Math.floor((100 * minesMultiplier(10, 15)) / 10000));
    expect(state.public.multiplierBps).toBe(32360724000);
  });
  it('rejects unsupported games/options and invalid randomness', () => {
    expect(() => rules().create(start('northline-reels'), now)).toThrow('no simulated');
    expect(() => rules().create(start('paper-dice', { chance: 0 }), now)).toThrow('integer');
    expect(() => rules().create(start('fable-plinko', { target: 2 }), now)).toThrow(
      'Unsupported settings',
    );
    expect(() =>
      new OriginalRules(
        () => 1.5,
        () => 'id',
      ).create(start('paper-dice'), now),
    ).toThrow('Random source');
  });
});
