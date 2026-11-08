import type { CricketMatch, DemoEvent, DemoMarket, DemoSelection, Page } from './types';
import { api } from './api-client';

export const eventPhaseLabel = (phase: DemoEvent['phase']) =>
  phase === 'demo-live'
    ? 'Demo in-play'
    : phase === 'completed'
      ? 'Completed demo'
      : 'Upcoming demo';
export const competitionHref = (sport: string, competition: string) =>
  `/sports/${encodeURIComponent(sport)}/competition/${encodeURIComponent(competition)}`;
export function selectionAvailable(
  event: DemoEvent,
  market: DemoMarket,
  selection: DemoSelection,
): boolean {
  return (
    event.phase !== 'completed' &&
    (!market.status || market.status === 'open') &&
    !selection.suspended
  );
}
/** Legal deliveries, never decimal arithmetic on an overs display. */
export function formatOvers(legalBalls: number): string {
  if (!Number.isSafeInteger(legalBalls) || legalBalls < 0) return '—';
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}
export function runRate(runs: number, balls: number): string {
  return balls > 0 ? ((runs * 6) / balls).toFixed(2) : '—';
}
export function requiredRate(match: CricketMatch): string {
  const innings = match.innings[(match.currentInnings ?? 0) - 1];
  if (!innings || !match.target || !match.inningsBallLimit) return '—';
  const remaining = match.inningsBallLimit - innings.legalBalls;
  if (innings.runs >= match.target) return '0.00';
  return remaining > 0 ? runRate(match.target - innings.runs, remaining) : '—';
}
export async function loadEvents(sport?: string): Promise<DemoEvent[]> {
  const endpoint = sport ? `/sports/${encodeURIComponent(sport)}/events` : '/sports/events';
  const items: DemoEvent[] = [];
  let page = 1;
  for (;;) {
    const result = await api<Page<DemoEvent>>(`${endpoint}?pageSize=50&page=${page}`);
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) return items;
    page += 1;
  }
}
export function filterEvents(
  events: readonly DemoEvent[],
  filters: {
    search: string;
    competition: string;
    phase: string;
    format: string;
    sort: string;
  },
): DemoEvent[] {
  const search = filters.search.trim().toLowerCase();
  return events
    .filter(
      (event) =>
        (!search || `${event.name} ${event.competition}`.toLowerCase().includes(search)) &&
        (!filters.competition || event.competition === filters.competition) &&
        (!filters.phase || event.phase === filters.phase) &&
        (!filters.format || event.cricket?.format === filters.format),
    )
    .sort((a, b) => {
      if (filters.sort === 'name') return a.name.localeCompare(b.name);
      if (filters.sort === 'popular')
        return Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name);
      return (
        (a.scheduledAt ?? '9999').localeCompare(b.scheduledAt ?? '9999') ||
        a.name.localeCompare(b.name)
      );
    });
}
