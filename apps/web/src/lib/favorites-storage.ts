import { z } from 'zod';

const schema = z.array(z.string().regex(/^[a-z0-9-]+$/)).max(100);
const key = (playerId: string) => `fable.favorites.${playerId}`;
export function readFavoriteIds(playerId: string): string[] {
  return schema.parse(JSON.parse(localStorage.getItem(key(playerId)) ?? '[]'));
}
export function saveFavoriteIds(playerId: string, ids: string[]): void {
  localStorage.setItem(key(playerId), JSON.stringify(schema.parse([...new Set(ids)])));
}
