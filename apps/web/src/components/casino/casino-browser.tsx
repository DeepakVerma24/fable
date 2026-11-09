'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { GameCard, GameGrid } from '@/components/game-card';
import { EmptyState, ErrorState, LoadingSkeleton, SectionHeader } from '@/components/states';
import { api } from '@/lib/api-client';
import { useFavorites } from '@/lib/favorites';
import { usePlayed } from '@/lib/played';
import type { DemoGame, Page } from '@/lib/types';

export function CasinoBrowser(props: { title: string; lockedCategory?: string }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CasinoBrowserInner {...props} />
    </Suspense>
  );
}
function CasinoBrowserInner({ title, lockedCategory }: { title: string; lockedCategory?: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const favorites = useFavorites();
  const played = usePlayed(favorites.playerId);
  const category = lockedCategory ?? params.get('category') ?? '';
  const query = params.get('q') ?? '';
  const provider = params.get('provider') ?? '';
  const availability = params.get('availability') ?? '';
  const sort = params.get('sort') ?? 'featured';
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const categories = useQuery({
    queryKey: ['casino-categories'],
    queryFn: () => api<{ items: { slug: string; name: string }[] }>('/casino/categories'),
  });
  const providers = useQuery({
    queryKey: ['casino-providers'],
    queryFn: () => api<{ items: string[] }>('/casino/providers'),
  });
  const games = useQuery({
    queryKey: ['casino-catalog', category, query, provider, availability, sort, page],
    queryFn: () => {
      const search = new URLSearchParams({ pageSize: '12', sort, page: String(page) });
      if (category) search.set('category', category);
      if (query.trim()) search.set('q', query.trim());
      if (provider) search.set('provider', provider);
      if (availability) search.set('availability', availability);
      return api<Page<DemoGame>>(`/casino/games?${search}`);
    },
  });
  const editorial = useQuery({
    queryKey: ['casino-editorial'],
    queryFn: () => api<Page<DemoGame>>('/casino/games?pageSize=50&sort=featured'),
  });
  function update(name: string, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    window.history.replaceState(null, '', `${pathname}?${next}`);
  }
  const all = editorial.data?.items ?? [];
  const hasFilters = Boolean(
    category || query || provider || availability || sort !== 'featured' || page > 1,
  );
  const recent = played.flatMap((item) => {
    const game = all.find((game) => game.id === item.gameId && game.playable);
    return game ? [game] : [];
  });
  const cards = (items: DemoGame[]) => (
    <GameGrid>
      {items.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          favorited={favorites.saved.has(game.id)}
          favoritePending={
            favorites.pending || favorites.query.isLoading || favorites.query.isError
          }
          onFavorite={favorites.playerId ? () => favorites.toggle(game.id) : undefined}
        />
      ))}
    </GameGrid>
  );
  return (
    <div className="casino-lobby space-y-6">
      <header className="casino-hero">
        <div>
          <p className="hero-eyebrow">THE FABLE COLLECTION</p>
          <h1 className="section-heading">{title}</h1>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">
            A considered collection of original previews and playable practice games. Explore at
            your own pace.
          </p>
          <p className="mt-3 max-w-lg text-xs text-faint">
            FABLE Originals are nonfinancial simulations. No cash value, wallet settlement, external
            providers or live dealers.
          </p>
          <Link href="/casino?category=originals&availability=playable" className="hero-action">
            Explore Originals <span aria-hidden>→</span>
          </Link>
        </div>
        <div
          className="casino-hero-art"
          role="img"
          aria-label="Original emerald and champagne casino illustration"
        />
      </header>
      <nav aria-label="Casino categories" className="flex flex-wrap gap-2">
        <Link
          href="/casino"
          className="sports-filter"
          aria-current={!category ? 'page' : undefined}
        >
          All games
        </Link>
        {categories.data?.items.map((item) => (
          <Link
            key={item.slug}
            href={`/casino?category=${item.slug}`}
            className="sports-filter"
            aria-current={category === item.slug ? 'page' : undefined}
          >
            {item.name}
          </Link>
        ))}
      </nav>
      {categories.isError || providers.isError ? (
        <ErrorState
          body="Category or provider navigation did not load."
          onRetry={() => {
            void categories.refetch();
            void providers.refetch();
          }}
        />
      ) : null}
      {!hasFilters && editorial.data ? (
        <section aria-label="Featured games">
          <SectionHeader eyebrow="Curated previews" title="Featured games" />
          {cards(all.filter((game) => game.featured).slice(0, 4))}
        </section>
      ) : null}
      <section aria-label="Game catalog" className="space-y-4">
        <SectionHeader title={hasFilters ? 'Your selection' : 'Explore the collection'} />
        <div className="sports-filters">
          <label>
            Search games
            <input
              type="search"
              aria-label="Search games"
              maxLength={80}
              placeholder="Title or description"
              value={query}
              onChange={(e) => update('q', e.target.value)}
            />
          </label>
          <label>
            Provider
            <select
              aria-label="Provider"
              value={provider}
              onChange={(e) => update('provider', e.target.value)}
            >
              <option value="">All FABLE labels</option>
              {providers.data?.items.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Availability
            <select
              aria-label="Availability"
              value={availability}
              onChange={(e) => update('availability', e.target.value)}
            >
              <option value="">All games & previews</option>
              <option value="playable">Playable nonfinancial demos</option>
              <option value="preview">Preview only</option>
            </select>
          </label>
          <label>
            Sort games
            <select
              aria-label="Sort games"
              value={sort}
              onChange={(e) => update('sort', e.target.value)}
            >
              <option value="featured">Featured first</option>
              <option value="popular">Most popular (catalog)</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
        {games.isLoading ? <LoadingSkeleton rows={4} /> : null}
        {games.isError ? (
          <ErrorState body="The catalog did not load." onRetry={() => void games.refetch()} />
        ) : null}
        {games.data ? (
          <>
            <p role="status" className="text-xs text-faint">
              {games.data.total} titles found · Popularity is an editorial ranking, not live
              activity.
            </p>
            {games.data.items.length ? (
              cards(games.data.items)
            ) : (
              <EmptyState
                title="No games found"
                body="Try another category or clear the search and filters."
              />
            )}
            <nav
              aria-label="Catalog pages"
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <button
                className="sports-filter"
                disabled={page === 1}
                onClick={() => update('page', String(page - 1))}
              >
                Previous
              </button>
              <span className="text-sm">
                Page {page} of {Math.max(1, Math.ceil(games.data.total / 12))}
              </span>
              <button
                className="sports-filter"
                disabled={page * 12 >= games.data.total}
                onClick={() => update('page', String(page + 1))}
              >
                Next
              </button>
            </nav>
          </>
        ) : null}
      </section>
      {favorites.error ? (
        <p role="alert" className="text-sm text-danger">
          Could not update favorites: {favorites.error}
        </p>
      ) : null}
      {favorites.query.isError ? (
        <ErrorState
          body="Favorites could not be loaded."
          onRetry={() => void favorites.query.refetch()}
        />
      ) : null}
      {!hasFilters ? (
        <>
          <section aria-label="Popular games">
            <SectionHeader title="Popular in the collection" eyebrow="Editorial selection" />
            {editorial.isLoading ? (
              <LoadingSkeleton />
            ) : editorial.isError ? (
              <ErrorState
                body="The collection did not load."
                onRetry={() => void editorial.refetch()}
              />
            ) : (
              cards([...all].sort((a, b) => b.popularity - a.popularity).slice(0, 4))
            )}
          </section>
          <section aria-label="FABLE Originals">
            <SectionHeader title="FABLE Originals" eyebrow="Nonfinancial practice" />
            {cards(all.filter((game) => game.playable))}
          </section>
        </>
      ) : null}
      <section aria-label="Recently played">
        <SectionHeader title="Recently played" />
        {recent.length ? (
          cards(recent.slice(0, 4))
        ) : (
          <EmptyState
            title="No games played yet"
            body={
              favorites.playerId
                ? 'Complete or start a server-confirmed Original round. Viewing a preview does not count as playing.'
                : 'Sign in and launch an Original. Played history is stored in this browser for your account.'
            }
          />
        )}
      </section>
      {favorites.playerId ? (
        <section aria-label="Saved games">
          <SectionHeader
            title="Your favorites"
            action={
              <Link className="text-sm underline" href="/favorites">
                View all
              </Link>
            }
          />
          {favorites.query.isLoading ? (
            <LoadingSkeleton />
          ) : favorites.query.data?.items.length ? (
            cards(favorites.query.data.items.slice(0, 4))
          ) : (
            <EmptyState
              title="No saved games"
              body="Save a title to keep it in your account favorites."
            />
          )}
        </section>
      ) : (
        <p className="text-sm">
          <Link className="underline" href="/login?next=/casino">
            Sign in to save favorites
          </Link>
        </p>
      )}
    </div>
  );
}
