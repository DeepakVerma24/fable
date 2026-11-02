import { beforeEach, describe, expect, it } from 'vitest';

import { useBetSlip, type SlipSelection } from './bet-slip';

const home: SlipSelection = {
  selectionId: 'home',
  selectionName: 'North Harbor',
  eventId: 'evt',
  eventName: 'North Harbor vs West Signal',
  marketName: 'Match result',
  decimalOdds: '1.91',
  suspended: false,
};

const away: SlipSelection = {
  ...home,
  selectionId: 'away',
  selectionName: 'West Signal',
  decimalOdds: '4.20',
};

describe('bet slip', () => {
  beforeEach(() => {
    useBetSlip.setState({ selection: null, pendingRequest: null, stake: '10.00', open: false });
  });

  it('keeps a single selection and removes it when chosen again', () => {
    useBetSlip.getState().toggle(home);
    expect(useBetSlip.getState().selection?.selectionId).toBe('home');
    expect(useBetSlip.getState().open).toBe(false);
    useBetSlip.getState().toggle(away);
    expect(useBetSlip.getState().selection?.selectionId).toBe('away');
    useBetSlip.getState().toggle(away);
    expect(useBetSlip.getState().selection).toBeNull();
  });

  it('rejects a non-numeric stake at the formatter boundary', () => {
    useBetSlip.getState().setStake('10.50');
    expect(useBetSlip.getState().stake).toBe('10.50');
    useBetSlip.getState().remove();
    expect(useBetSlip.getState().selection).toBeNull();
  });
});

describe('pending bet request identity', () => {
  beforeEach(() => useBetSlip.setState({ pendingRequest: null }));
  it('reuses the operation identity when a response is lost', () => {
    const store = useBetSlip.getState();
    const key = store.requestKey('selection', 1000n);
    expect(store.requestKey('selection', 1000n)).toBe(key);
  });
  it('uses a new identity for changed economic terms', () => {
    const store = useBetSlip.getState();
    const first = store.requestKey('selection', 1000n);
    const second = store.requestKey('selection', 2000n);
    expect(second).not.toBe(first);
    expect(store.requestKey('other', 2000n)).not.toBe(second);
  });
  it('starts a new operation after success removes the slip', () => {
    const store = useBetSlip.getState();
    const key = store.requestKey('selection', 1000n);
    store.remove();
    expect(store.requestKey('selection', 1000n)).not.toBe(key);
  });
});
