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
    useBetSlip.setState({ selection: null, stake: '10.00', open: false });
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
