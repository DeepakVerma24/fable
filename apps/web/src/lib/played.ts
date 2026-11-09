'use client';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

const entry = z.object({ gameId: z.string().min(1).max(80), playedAt: z.string().datetime() });
const schema = z.array(entry).max(12);
export type PlayedGame = z.infer<typeof entry>;
const listeners = new Set<() => void>();
const empty: PlayedGame[] = [];
let cachedKey = '';
let cachedRaw = '';
let cached: PlayedGame[] = empty;
const key = (playerId: string) => `fable.played.${playerId}`;
export function readPlayed(playerId: string | undefined): PlayedGame[] {
  if (!playerId || typeof localStorage === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(key(playerId)) ?? '[]';
    if (raw === cachedRaw && cachedKey === playerId) return cached;
    const parsed = schema.safeParse(JSON.parse(raw));
    cachedKey = playerId;
    cachedRaw = raw;
    cached = parsed.success ? parsed.data : empty;
    return cached;
  } catch {
    return empty;
  }
}
/** Only call after the server confirms a round, never when viewing a preview. */
export function rememberPlayed(playerId: string, gameId: string): void {
  try {
    localStorage.setItem(
      key(playerId),
      JSON.stringify(
        [
          { gameId, playedAt: new Date().toISOString() },
          ...readPlayed(playerId).filter((item) => item.gameId !== gameId),
        ].slice(0, 12),
      ),
    );
    listeners.forEach((listener) => listener());
  } catch {
    /* Optional discovery history is not needed to recover rounds. */
  }
}
export function usePlayed(playerId: string | undefined): PlayedGame[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      window.addEventListener('storage', listener);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', listener);
      };
    },
    () => readPlayed(playerId),
    () => empty,
  );
}
