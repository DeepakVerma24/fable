'use client';
import Link from 'next/link';
import { GameCard, GameGrid } from '@/components/game-card';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states';
import { useFavorites } from '@/lib/favorites';
export default function FavoritesPage() {
  const favorites = useFavorites();
  if (favorites.session.isLoading || favorites.query.isLoading) return <LoadingSkeleton />;
  if (!favorites.playerId)
    return (
      <Link href="/login?next=/favorites" className="underline">
        Sign in to view favorites
      </Link>
    );
  return (
    <div className="space-y-4">
      <h1 className="section-heading">Favorites</h1>
      <p className="text-sm text-muted-foreground">
        Titles saved in this browser and the current API session. Only implemented Originals can
        launch a nonfinancial demo.
      </p>
      {favorites.query.isError ? (
        <ErrorState
          body="Saved games could not be loaded."
          onRetry={() => void favorites.query.refetch()}
        />
      ) : favorites.query.data?.items.length ? (
        <GameGrid>
          {favorites.query.data.items.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              favorited
              favoritePending={favorites.pending}
              onFavorite={() => favorites.toggle(game.id)}
            />
          ))}
        </GameGrid>
      ) : (
        <EmptyState title="No favorites" body="Save a title from the casino lobby." />
      )}
      {favorites.error ? (
        <p role="alert" className="text-sm text-danger">
          Could not update favorites: {favorites.error}
        </p>
      ) : null}
    </div>
  );
}
