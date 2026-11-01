'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { GameCard, GameGrid } from '@/components/game-card';
import { useSession } from '@/components/shell/use-session';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api-client';
import type { DemoGame, Page } from '@/lib/types';

const categories = [
  { slug: '', label: 'All' },
  { slug: 'slots', label: 'Slots' },
  { slug: 'live', label: 'Live Casino' },
  { slug: 'table', label: 'Table Games' },
  { slug: 'originals', label: 'Originals' },
  { slug: 'new', label: 'New' },
  { slug: 'popular', label: 'Popular' },
];

export function CasinoBrowser(props: { title: string; lockedCategory?: string }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CasinoBrowserInner {...props} />
    </Suspense>
  );
}

function CasinoBrowserInner({ title, lockedCategory }: { title: string; lockedCategory?: string }) {
  const params = useSearchParams();
  const fromQuery = params.get('category') ?? '';
  const [category, setCategory] = useState<string | null>(null);
  const queried = categories.some((item) => item.slug === fromQuery) ? fromQuery : '';
  const activeCategory = lockedCategory ?? category ?? queried;
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('');
  const session = useSession();
  const queryClient = useQueryClient();
  const games = useQuery({
    queryKey: ['games', activeCategory, query, provider],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '24', sort: 'featured' });
      if (activeCategory) params.set('category', activeCategory);
      if (query.trim()) params.set('q', query.trim());
      if (provider) params.set('provider', provider);
      return api<Page<DemoGame>>(`/casino/games?${params.toString()}`);
    },
  });
  const favorites = useQuery({
    queryKey: ['favorites'],
    enabled: Boolean(session.data?.player),
    queryFn: () => api<{ items: DemoGame[] }>('/favorites'),
  });
  const saved = useMemo(
    () => new Set((favorites.data?.items ?? []).map((game) => game.id)),
    [favorites.data],
  );

  async function toggleFavorite(gameId: string) {
    if (!session.data?.player) return;
    const method = saved.has(gameId) ? 'DELETE' : 'PUT';
    try {
      await api(`/favorites/${gameId}`, { method });
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
    } catch (error) {
      if (error instanceof ApiError) return;
      throw error;
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Casino</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Original previews from FABLE. They are not playable and they are not licensed games.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
        <div>
          <Label htmlFor="game-search">Search previews</Label>
          <Input
            id="game-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1 h-11"
          />
        </div>
        <div>
          <Label htmlFor="provider">Provider</Label>
          <select
            id="provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">All providers</option>
            <option value="FABLE Preview">FABLE Preview</option>
          </select>
        </div>
      </div>
      {lockedCategory ? null : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
          {categories.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={activeCategory === item.slug}
              className={`inline-flex h-11 items-center rounded-md border px-3 text-sm ${activeCategory === item.slug ? 'border-white bg-white text-primary-foreground' : 'border-border'}`}
              onClick={() => setCategory(item.slug)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {games.isLoading ? <LoadingSkeleton /> : null}
      {games.isError ? (
        <ErrorState body="The catalog did not load." onRetry={() => void games.refetch()} />
      ) : null}
      {games.data && games.data.items.length === 0 ? (
        <EmptyState title="No previews" body="Try another category or clear the search." />
      ) : null}
      <GameGrid>
        {games.data?.items.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            favorited={saved.has(game.id)}
            onFavorite={session.data?.player ? () => void toggleFavorite(game.id) : undefined}
          />
        ))}
      </GameGrid>
      {session.data?.player && favorites.data ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Recently saved</h2>
          {favorites.data.items.length === 0 ? (
            <EmptyState
              title="No saved previews"
              body="Use Save on a tile. Favorites stay with this session’s player record."
            />
          ) : (
            <GameGrid>
              {favorites.data.items.slice(0, 4).map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  favorited
                  onFavorite={() => void toggleFavorite(game.id)}
                />
              ))}
            </GameGrid>
          )}
        </section>
      ) : null}
    </div>
  );
}
