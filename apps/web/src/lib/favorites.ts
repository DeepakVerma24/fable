'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/components/shell/use-session';
import { api, ApiError } from './api-client';
import { readFavoriteIds, saveFavoriteIds } from './favorites-storage';
import type { DemoGame } from './types';

export function useFavorites() {
  const session = useSession();
  const playerId = session.data?.player.id;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['favorites', playerId],
    enabled: Boolean(playerId),
    queryFn: async () => {
      if (!playerId) return { items: [] as DemoGame[] };
      const remote = await api<{ items: DemoGame[] }>('/favorites');
      const missing = readFavoriteIds(playerId).filter(
        (id) => !remote.items.some((game) => game.id === id),
      );
      const restored = await Promise.all(
        missing.map(async (id) => {
          try {
            return await api<DemoGame>(`/casino/games/${encodeURIComponent(id)}`);
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) return null;
            throw error;
          }
        }),
      );
      const items = [
        ...remote.items,
        ...restored.filter((game): game is DemoGame => game !== null),
      ];
      saveFavoriteIds(
        playerId,
        items.map((game) => game.id),
      );
      return { items };
    },
  });
  const mutation = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (!playerId) throw new Error('Sign in to save games.');
      await api(`/favorites/${encodeURIComponent(id)}`, { method: saved ? 'DELETE' : 'PUT' });
      const ids = readFavoriteIds(playerId);
      saveFavoriteIds(playerId, saved ? ids.filter((value) => value !== id) : [...ids, id]);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['favorites', playerId] }),
  });
  return {
    query,
    playerId,
    session,
    saved: new Set(query.data?.items.map((game) => game.id) ?? []),
    pending: mutation.isPending,
    error: mutation.error?.message,
    toggle: (id: string) => {
      if (!mutation.isPending)
        mutation.mutate({ id, saved: Boolean(query.data?.items.some((game) => game.id === id)) });
    },
  };
}
