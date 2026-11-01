'use client';

import { useSyncExternalStore } from 'react';

export interface RecentItem {
  kind: 'game' | 'event';
  id: string;
  title: string;
  href: string;
}

const KEY = 'fable.recent';
const empty: RecentItem[] = [];
const listeners = new Set<() => void>();
let cachedRaw = '';
let cached: RecentItem[] = empty;

function read(): RecentItem[] {
  if (typeof window === 'undefined') return empty;
  const raw = window.sessionStorage.getItem(KEY) ?? '[]';
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw) as RecentItem[];
    cached = Array.isArray(parsed) ? parsed.slice(0, 6) : empty;
  } catch {
    cached = empty;
  }
  return cached;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function rememberRecent(item: RecentItem): void {
  const next = [item, ...read().filter((entry) => entry.id !== item.id)].slice(0, 6);
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
  emit();
}

export function useRecent(): RecentItem[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => empty,
  );
}
