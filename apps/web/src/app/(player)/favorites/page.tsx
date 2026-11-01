'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { GameCard, GameGrid } from '@/components/game-card';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states';
import { api } from '@/lib/api-client';
import type { DemoGame } from '@/lib/types';

export default function FavoritesPage() {
  const queryClient = useQueryClient();
  const favorites = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api<{ items: DemoGame[] }>('/favorites'),
  });

  if (favorites.isLoading) return <LoadingSkeleton />;
  if (favorites.isError || !favorites.data) {
    return (
      <ErrorState
        body="Saved previews could not be loaded."
        onRetry={() => void favorites.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Saved</p>
        <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Previews you saved. They still do not launch.
        </p>
      </header>
      {favorites.data.items.length === 0 ? (
        <EmptyState title="No favorites" body="Save a preview from the casino lobby." />
      ) : (
        <GameGrid>
          {favorites.data.items.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              favorited
              onFavorite={() => {
                void api(`/favorites/${game.id}`, { method: 'DELETE' }).then(() =>
                  queryClient.invalidateQueries({ queryKey: ['favorites'] }),
                );
              }}
            />
          ))}
        </GameGrid>
      )}
    </div>
  );
}
