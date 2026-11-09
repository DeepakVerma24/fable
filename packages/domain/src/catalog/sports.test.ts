import { describe, expect, it } from 'vitest';
import { DEMO_EVENTS, eventsForSport, quoteSelection, sportBySlug } from './sports';
describe('simulated cricket catalog boundary', () => {
  it('configures named competitions without implying real fixtures', () => {
    expect(sportBySlug('cricket')?.competitions).toContain('Indian Premier League (IPL)');
    expect(eventsForSport('cricket', 'Indian Premier League (IPL)')).toHaveLength(0);
    expect(eventsForSport('cricket').map((event) => event.cricket?.format)).toEqual([
      'T20',
      'ODI',
      'Test',
      'T10',
    ]);
  });
  it('quotes only enabled simulated selections', () => {
    expect(quoteSelection('crk-ivory-t20-winner-home')?.market.name).toBe('Match Winner');
    expect(quoteSelection('crk-archive-test-winner-home')).toBeNull();
    expect(quoteSelection('crk-coast-t10-winner-home')).toBeNull();
    expect(quoteSelection('crk-ivory-t20-preview-0-home')).toBeNull();
    expect(quoteSelection('fbl-north-harbor-result-away')).not.toBeNull();
  });
  it('has globally unique event and selection IDs and valid cricket score data', () => {
    expect(new Set(DEMO_EVENTS.map((event) => event.id)).size).toBe(DEMO_EVENTS.length);
    const ids = DEMO_EVENTS.flatMap((event) =>
      event.markets.flatMap((market) => market.selections.map((selection) => selection.id)),
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const event of eventsForSport('cricket'))
      for (const innings of event.cricket?.innings ?? []) {
        expect(Number.isInteger(innings.legalBalls)).toBe(true);
        expect(innings.legalBalls).toBeGreaterThanOrEqual(0);
        expect(innings.wickets).toBeLessThanOrEqual(10);
      }
  });
});
