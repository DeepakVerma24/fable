import { describe, expect, it } from 'vitest';
import { formatOvers, requiredRate, runRate, filterEvents } from './sports';
import type { DemoEvent } from './types';
describe('cricket display', () => {
  it('uses six legal deliveries per over', () => {
    expect(formatOvers(0)).toBe('0.0');
    expect(formatOvers(5)).toBe('0.5');
    expect(formatOvers(6)).toBe('1.0');
    expect(formatOvers(119)).toBe('19.5');
    expect(formatOvers(120)).toBe('20.0');
    expect(formatOvers(-1)).toBe('—');
    expect(formatOvers(19.5)).toBe('—');
  });
  it('computes rates from balls, including the final ball and no-ball-limit formats', () => {
    expect(runRate(170, 119)).toBe('8.57');
    expect(runRate(0, 0)).toBe('—');
    const match = {
      format: 'T20' as const,
      currentInnings: 1,
      inningsBallLimit: 120,
      target: 177,
      innings: [{ team: 'Demo', runs: 170, wickets: 5, legalBalls: 119 }],
    };
    expect(requiredRate(match)).toBe('42.00');
    expect(requiredRate({ ...match, inningsBallLimit: undefined })).toBe('—');
    expect(requiredRate({ ...match, inningsBallLimit: 119 })).toBe('—');
  });
});
it('combines sport format, competition, phase and text filters without fabricating fixtures', () => {
  const event: DemoEvent = {
    id: 'demo',
    sport: 'cricket',
    competition: 'Fable T20',
    name: 'Ivory vs Emerald',
    participants: ['Ivory', 'Emerald'],
    scheduleLabel: 'Demo',
    phase: 'demo-live',
    popular: true,
    markets: [],
    cricket: { format: 'T20', innings: [] },
  };
  const filters = {
    search: 'ivory',
    competition: 'Fable T20',
    phase: 'demo-live',
    format: 'T20',
    sort: 'time',
  };
  expect(filterEvents([event], filters)).toHaveLength(1);
  expect(filterEvents([event], { ...filters, competition: 'IPL' })).toHaveLength(0);
  expect(filterEvents([event], { ...filters, format: 'ODI' })).toHaveLength(0);
});
