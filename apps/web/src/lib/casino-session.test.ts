import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  casinoRequest,
  commandKey,
  readCasinoCommand,
  saveCasinoCommand,
  type CasinoCommand,
} from './casino-session';
import { readFavoriteIds, saveFavoriteIds } from './favorites-storage';
import { readPlayed, rememberPlayed } from './played';

const pending: CasinoCommand = {
  kind: 'start',
  playerId: 'a',
  gameId: 'paper-dice',
  sessionId: '80603a21-1455-48f3-b84c-598221f508ab',
  idempotencyKey: '80603a21-1455-48f3-b84c-598221f508ac',
  options: { chance: 50 },
};
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
describe('casino request recovery and account persistence', () => {
  it('keeps played history account-scoped even when another account has corrupt storage', () => {
    rememberPlayed('history-a', 'paper-dice');
    rememberPlayed('history-a', 'fable-mines');
    rememberPlayed('history-a', 'paper-dice');
    expect(readPlayed('history-a').map((item) => item.gameId)).toEqual([
      'paper-dice',
      'fable-mines',
    ]);
    localStorage.setItem('fable.played.history-b', '{broken');
    expect(readPlayed('history-b')).toEqual([]);
    expect(readPlayed('history-b')).toEqual([]);
    expect(readPlayed(undefined)).toEqual([]);
    expect(readPlayed('history-a').map((item) => item.gameId)).toEqual([
      'paper-dice',
      'fable-mines',
    ]);
  });
  it('persists the exact replay request and isolates accounts', () => {
    saveCasinoCommand(pending);
    expect(readCasinoCommand('a', 'paper-dice')).toEqual(pending);
    expect(readCasinoCommand('b', 'paper-dice')).toBeNull();
    localStorage.setItem(commandKey('b', 'paper-dice'), JSON.stringify(pending));
    expect(() => readCasinoCommand('b', 'paper-dice')).toThrow('another account');
  });
  it('sends only server input fields, never player IDs or client outcomes', () => {
    const input = { ...pending, returnPoints: 9999, outcome: 'hit' };
    expect(casinoRequest(input)).toEqual({
      path: '/casino/demo/rounds',
      body: {
        sessionId: pending.sessionId,
        idempotencyKey: pending.idempotencyKey,
        gameId: 'paper-dice',
        options: { chance: 50 },
      },
    });
    const action: CasinoCommand = {
      ...pending,
      kind: 'action',
      roundId: pending.sessionId,
      expectedVersion: 1,
      type: 'reveal',
      cell: 4,
    };
    expect(casinoRequest(action).body).toEqual({
      sessionId: pending.sessionId,
      idempotencyKey: pending.idempotencyKey,
      expectedVersion: 1,
      type: 'reveal',
      cell: 4,
    });
  });
  it('fails closed for corrupt recovery data and failed storage writes', () => {
    localStorage.setItem(commandKey('a', 'paper-dice'), '{broken');
    expect(() => readCasinoCommand('a', 'paper-dice')).toThrow();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage full');
    });
    expect(() => saveCasinoCommand(pending)).toThrow('storage full');
  });
  it('persists a deduplicated favorites list per player and validates cached IDs', () => {
    saveFavoriteIds('a', ['paper-dice', 'paper-dice', 'fable-mines']);
    expect(readFavoriteIds('a')).toEqual(['paper-dice', 'fable-mines']);
    expect(readFavoriteIds('b')).toEqual([]);
    expect(() => saveFavoriteIds('a', ['../not-a-game'])).toThrow();
  });
});
