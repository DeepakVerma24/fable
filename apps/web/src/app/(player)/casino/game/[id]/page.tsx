'use client';
import { Suspense, use, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PreviewMark } from '@/components/preview-mark';
import { OriginalPlayer } from '@/components/casino/original-player';
import { ErrorState, LoadingSkeleton } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { useFavorites } from '@/lib/favorites';
import { rememberRecent } from '@/lib/recent';
import type { DemoGame } from '@/lib/types';

export default function GamePage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <GameDetails {...props} />
    </Suspense>
  );
}
function GameDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const favorites = useFavorites();
  const launched = useSearchParams().get('play') === '1';
  function launch() {
    if (launched) return;
    const url = new URL(window.location.href);
    url.searchParams.set('play', '1');
    window.history.pushState(null, '', url);
  }
  const game = useQuery({
    queryKey: ['game', id],
    queryFn: () => api<DemoGame>(`/casino/games/${encodeURIComponent(id)}`),
  });
  useEffect(() => {
    if (game.data)
      rememberRecent({
        kind: 'game',
        id: game.data.id,
        title: game.data.name,
        href: `/casino/game/${game.data.id}`,
      });
  }, [game.data]);
  if (game.isLoading) return <LoadingSkeleton />;
  if (game.isError || !game.data)
    return (
      <ErrorState
        title="Game unavailable"
        body="This game could not be loaded from the catalog."
        onRetry={() => void game.refetch()}
      />
    );
  const current = game.data;
  const playable = current.playable && Boolean(current.originalKind);
  return (
    <article className="space-y-6">
      <Link className="inline-flex min-h-11 items-center text-sm underline" href="/casino">
        ← Back to lobby
      </Link>
      <div className="game-detail-intro grid gap-6 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <PreviewMark seed={current.id} label={current.name} />
        <div>
          <Badge variant="outline">
            {playable ? 'Playable nonfinancial demo' : 'Preview · not playable'}
          </Badge>
          <h1 className="section-heading mt-3">{current.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{current.summary}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-faint">Provider label</dt>
              <dd>
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={`/casino?provider=${encodeURIComponent(current.provider)}`}
                >
                  {current.provider}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Categories</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {current.categories.map((category) => (
                  <Link
                    className="sports-filter"
                    key={category}
                    href={`/casino?category=${category}`}
                  >
                    {category.replaceAll('-', ' ')}
                  </Link>
                ))}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-faint">
            {playable
              ? 'Server-generated outcomes. Practice points have no cash value and never change your wallet. No independently verified fairness claim is made.'
              : 'No playable provider client or live dealer is connected. This artwork is a discovery preview only.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {playable ? (
              favorites.playerId ? (
                <Button className="min-h-11" onClick={launch}>
                  Play nonfinancial demo
                </Button>
              ) : (
                <Button asChild className="min-h-11">
                  <Link
                    href={`/login?next=${encodeURIComponent(`/casino/game/${current.id}?play=1`)}`}
                  >
                    Sign in to play demo
                  </Link>
                </Button>
              )
            ) : (
              <Button className="min-h-11" disabled>
                Play unavailable
              </Button>
            )}
            {favorites.playerId ? (
              <Button
                variant="outline"
                className="min-h-11"
                disabled={favorites.pending || favorites.query.isLoading || favorites.query.isError}
                onClick={() => favorites.toggle(current.id)}
                aria-pressed={favorites.saved.has(current.id)}
              >
                {favorites.saved.has(current.id) ? 'Remove from favorites' : 'Save to favorites'}
              </Button>
            ) : (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/login?next=/casino/game/${current.id}`}>Sign in to save</Link>
              </Button>
            )}
          </div>
          {favorites.error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              Could not update favorites: {favorites.error}
            </p>
          ) : null}
          {favorites.query.isError ? (
            <ErrorState
              body="Favorites did not load."
              onRetry={() => void favorites.query.refetch()}
            />
          ) : null}
        </div>
      </div>
      {playable && launched && favorites.playerId ? (
        <OriginalPlayer
          key={`${favorites.playerId}:${id}`}
          gameId={id}
          playerId={favorites.playerId}
        />
      ) : null}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-2xl font-[Georgia]">Rules & information</h2>
        <ul className="mt-3 list-disc space-y-3 pl-5 text-sm text-muted-foreground">
          {(
            current.rules ?? [
              'This title is a static catalog preview. No rounds, outcomes or payouts are available.',
              'A working game integration and published rules would be required before Play can be enabled.',
            ]
          ).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        {playable ? (
          <p className="mt-3 text-sm text-faint">
            All returns use a fixed 100-point reference. No points are purchased, wagered,
            transferred or added to an account balance.
          </p>
        ) : null}
      </section>
      <details className="rounded-lg border border-border p-4">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
          Help & session recovery
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          {playable
            ? 'If a response is uncertain, retry the saved action; it uses the same request ID. Reload the practice room to restore your Mines board and saved history. You can resume on another device after signing in. Recently played titles stay in this browser. No financial transaction occurs.'
            : 'Browse other titles or choose the playable Originals collection. No unavailable integration can be launched.'}
        </p>
      </details>
    </article>
  );
}
