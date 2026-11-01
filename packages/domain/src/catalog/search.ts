import { DEMO_GAMES, type DemoGame } from './games';
import { DEMO_EVENTS, type DemoEvent } from './sports';

export interface CatalogSearchHit {
  kind: 'game' | 'event';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function searchCatalog(query: string): readonly CatalogSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 1) return [];
  const games: CatalogSearchHit[] = DEMO_GAMES.filter((game) => gameMatches(game, needle)).map(
    (game) => ({
      kind: 'game',
      id: game.id,
      title: game.name,
      subtitle: `${game.categories.join(' · ')} · Preview`,
      href: `/casino/game/${game.id}`,
    }),
  );
  const events: CatalogSearchHit[] = DEMO_EVENTS.filter((event) => eventMatches(event, needle)).map(
    (event) => ({
      kind: 'event',
      id: event.id,
      title: event.name,
      subtitle: `${event.competition} · Demo odds`,
      href: `/sports/event/${event.id}`,
    }),
  );
  return [...events, ...games].slice(0, 20);
}

function gameMatches(game: DemoGame, needle: string): boolean {
  return (
    game.name.toLowerCase().includes(needle) ||
    game.categories.some((category) => category.includes(needle))
  );
}

function eventMatches(event: DemoEvent, needle: string): boolean {
  return (
    event.name.toLowerCase().includes(needle) ||
    event.sport.includes(needle) ||
    event.competition.toLowerCase().includes(needle) ||
    event.participants.some((team) => team.toLowerCase().includes(needle))
  );
}
