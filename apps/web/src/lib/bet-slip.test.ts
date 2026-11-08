import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PENDING_STORAGE_KEY,
  SLIP_STORAGE_KEY,
  saveSlip,
  useBetSlip,
  type SlipSelection,
} from './bet-slip';
import { submitSingle, currentQuote } from './bet-placement';
import { api, ApiError } from './api-client';
import type { DemoBet, DemoEvent } from './types';
vi.mock('./api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client')>()),
  api: vi.fn(),
}));
const home: SlipSelection = {
  selectionId: 'home',
  selectionName: 'North Harbor',
  eventId: 'evt',
  eventName: 'North Harbor vs West Signal',
  marketName: 'Match result',
  decimalOdds: '1.91',
  suspended: false,
};
const away = { ...home, selectionId: 'away', selectionName: 'West Signal', decimalOdds: '4.20' };
const event: DemoEvent = {
  id: 'evt',
  sport: 'football',
  competition: 'Demo',
  name: home.eventName,
  participants: ['North Harbor', 'West Signal'],
  scheduleLabel: 'Demo',
  phase: 'upcoming',
  popular: false,
  markets: [
    {
      id: 'result',
      name: 'Match result',
      selections: [{ id: 'home', name: home.selectionName, decimalOdds: '1.91', suspended: false }],
    },
  ],
};
const bet = {
  id: 'receipt',
  outcome: 'win',
  note: 'Demo',
  stakeMinor: '1000',
  payoutMinor: '1910',
} as DemoBet;
const calls: { idempotencyKey: string; selectionId: string; stakeMinor: string }[] = [];
let response: 'ok' | 'lost' | 'rejected' = 'ok';
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal('navigator', {
    locks: { request: async (_: string, fn: () => Promise<unknown>) => fn() },
  });
  useBetSlip.setState({
    selections: [],
    activeId: null,
    pending: null,
    stake: '10.00',
    open: false,
    mode: 'single',
    hydrated: true,
    busy: false,
    error: null,
    storageError: null,
    result: null,
  });
  calls.length = 0;
  response = 'ok';
  vi.mocked(api).mockImplementation(async (path, init) => {
    if (path === '/auth/me') return { player: { id: 'player' } } as never;
    if (path.startsWith('/sports/events')) return event as never;
    if (path === '/demo/bets') {
      expect(JSON.parse(localStorage.getItem(PENDING_STORAGE_KEY)!)).not.toBeNull();
      calls.push(JSON.parse(init!.body as string));
      if (response === 'lost') throw new TypeError('Lost response');
      if (response === 'rejected') throw new ApiError('Insufficient funds', 400);
      return bet as never;
    }
    throw new Error('Unexpected request');
  });
});
describe('persistent multi-draft slip', () => {
  it('adds multiple drafts without duplicates and toggles a selected price off', () => {
    useBetSlip.getState().toggle(home);
    useBetSlip.getState().toggle(away);
    expect(useBetSlip.getState().selections).toHaveLength(2);
    useBetSlip.getState().toggle(away);
    expect(useBetSlip.getState().selections.map((item) => item.selectionId)).toEqual(['home']);
  });
  it('restores draft selections, stake and mode after reload', () => {
    useBetSlip.getState().toggle(home);
    useBetSlip.getState().setStake('25.00');
    useBetSlip.getState().setMode('accumulator');
    useBetSlip.setState({ selections: [], stake: '', mode: 'single' });
    useBetSlip.getState().hydrate();
    expect(useBetSlip.getState()).toMatchObject({
      selections: [home],
      stake: '25.00',
      mode: 'accumulator',
    });
  });
  it('does not discard corrupt recovery data', () => {
    localStorage.setItem(SLIP_STORAGE_KEY, '{bad');
    useBetSlip.getState().hydrate();
    expect(useBetSlip.getState().storageError).toContain('could not be read');
    expect(localStorage.getItem(SLIP_STORAGE_KEY)).toBe('{bad');
  });
});
describe('single-bet submission safety', () => {
  it('rejects accumulator submission before any betting POST', async () => {
    useBetSlip.getState().toggle(home);
    useBetSlip.getState().setMode('accumulator');
    await submitSingle('player');
    expect(calls).toHaveLength(0);
    expect(useBetSlip.getState().error).toContain('Accumulator placement is unavailable');
  });
  it('restores the exact pending request after a lost response and reload', async () => {
    useBetSlip.getState().toggle(home);
    response = 'lost';
    await submitSingle('player');
    expect(useBetSlip.getState().pending?.status).toBe('uncertain');
    useBetSlip.getState().remove('home');
    useBetSlip.getState().setStake('20');
    useBetSlip.getState().clear();
    expect(useBetSlip.getState().selections).toHaveLength(1);
    expect(useBetSlip.getState().stake).toBe('10.00');
    useBetSlip.setState({ pending: null });
    useBetSlip.getState().hydrate();
    response = 'ok';
    await submitSingle('player');
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(useBetSlip.getState().pending).toBeNull();
  });
  it("never replays another player's saved request", async () => {
    useBetSlip.getState().toggle(home);
    response = 'lost';
    await submitSingle('player');
    await submitSingle('other');
    expect(calls).toHaveLength(1);
    expect(useBetSlip.getState().pending?.playerId).toBe('player');
  });
  it('definitive rejection unlocks the draft without reporting success', async () => {
    useBetSlip.getState().toggle(home);
    response = 'rejected';
    await submitSingle('player');
    expect(useBetSlip.getState().pending).toBeNull();
    expect(useBetSlip.getState().error).toBe('Insufficient funds');
    expect(useBetSlip.getState().result).toBeNull();
  });
  it('prevents simultaneous duplicate submissions', async () => {
    useBetSlip.getState().toggle(home);
    await Promise.all([submitSingle('player'), submitSingle('player')]);
    expect(calls).toHaveLength(1);
  });
  it('requires successful durable storage before sending', async () => {
    useBetSlip.getState().toggle(home);
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    await submitSingle('player');
    expect(calls).toHaveLength(0);
    expect(useBetSlip.getState().storageError).toContain('storage');
  });
  it('refuses a draft changed by another tab', async () => {
    useBetSlip.getState().toggle(home);
    const disk = JSON.parse(localStorage.getItem(SLIP_STORAGE_KEY)!);
    disk.selections = [];
    localStorage.setItem(SLIP_STORAGE_KEY, JSON.stringify(disk));
    await submitSingle('player');
    expect(calls).toHaveLength(0);
    expect(useBetSlip.getState().error).toContain('another tab');
  });
  it('preserves unsubmitted selections after a confirmed single', async () => {
    useBetSlip.getState().toggle(away);
    useBetSlip.getState().toggle(home);
    await submitSingle('player');
    expect(useBetSlip.getState().selections).toEqual([away]);
    expect(useBetSlip.getState().result?.bet).toEqual(bet);
  });
  it('blocks invalid stakes and changed odds before submission', async () => {
    useBetSlip.getState().toggle(home);
    useBetSlip.getState().setStake('0.01');
    await submitSingle('player');
    expect(calls).toHaveLength(0);
    useBetSlip.getState().setStake('10.00');
    saveSlip({ selections: [{ ...home, decimalOdds: '2.00' }] });
    await submitSingle('player');
    expect(calls).toHaveLength(0);
    expect(useBetSlip.getState().error).toContain('Odds changed');
  });
  it('marks removed, suspended and completed quotes unavailable', () => {
    expect(currentQuote(event, away)).toBeNull();
    expect(currentQuote({ ...event, phase: 'completed' }, home)?.suspended).toBe(true);
    expect(
      currentQuote({ ...event, markets: [{ ...event.markets[0]!, status: 'suspended' }] }, home)
        ?.suspended,
    ).toBe(true);
  });
});

describe('cross-tab recovery storage', () => {
  it('draft edits cannot overwrite a pending record from another tab', async () => {
    useBetSlip.getState().toggle(home);
    response = 'lost';
    await submitSingle('player');
    const pending = localStorage.getItem(PENDING_STORAGE_KEY);
    useBetSlip.setState({ pending: null }); // Tab has not received its storage event yet.
    useBetSlip.getState().setStake('99.00');
    expect(localStorage.getItem(PENDING_STORAGE_KEY)).toBe(pending);
    expect(useBetSlip.getState().pending).not.toBeNull();
    expect(useBetSlip.getState().stake).toBe('10.00');
  });
  it('never overwrites another operation during stale recovery', async () => {
    useBetSlip.getState().toggle(home);
    response = 'lost';
    await submitSingle('player');
    const different = { ...useBetSlip.getState().pending!, key: 'slip-' + 'a'.repeat(32) };
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(different));
    await submitSingle('player');
    expect(calls).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(PENDING_STORAGE_KEY)!).key).toBe(different.key);
    expect(useBetSlip.getState().error).toContain('Another tab');
  });
  it('corrupt recovery data blocks clearing and adding drafts', () => {
    localStorage.setItem(SLIP_STORAGE_KEY, '{broken');
    useBetSlip.getState().hydrate();
    useBetSlip.getState().clear();
    useBetSlip.getState().toggle(home);
    expect(localStorage.getItem(SLIP_STORAGE_KEY)).toBe('{broken');
  });
});
