'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { PreviewMark } from '@/components/preview-mark';
import { useSession } from '@/components/shell/use-session';
import { ErrorState, LoadingSkeleton } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { rememberRecent } from '@/lib/recent';
import type { DemoGame } from '@/lib/types';

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSession();
  const queryClient = useQueryClient();
  const game = useQuery({
    queryKey: ['game', id],
    queryFn: () => api<DemoGame & { simulated: true }>(`/casino/games/${id}`),
  });

  useEffect(() => {
    if (!game.data) return;
    rememberRecent({
      kind: 'game',
      id: game.data.id,
      title: game.data.name,
      href: `/casino/game/${game.data.id}`,
    });
  }, [game.data]);

  if (game.isLoading) return <LoadingSkeleton />;
  if (game.isError || !game.data) {
    return <ErrorState title="Preview missing" body="That tile is not in the demo catalog." />;
  }

  const current = game.data;

  return (
    <article className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <PreviewMark seed={current.id} label={current.name} />
      <div>
        <Badge variant="outline">Preview · not playable</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{current.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{current.summary}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-border py-2">
            <dt className="text-muted-foreground">Provider</dt>
            <dd>{current.provider}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border py-2">
            <dt className="text-muted-foreground">Categories</dt>
            <dd>{current.categories.join(', ')}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">Launch</dt>
            <dd>Unavailable</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-faint">
          There is no game client behind this page. FABLE does not pretend a missing integration is
          playable.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {session.data?.player ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => {
                void api(`/favorites/${current.id}`, { method: 'PUT' }).then(() =>
                  queryClient.invalidateQueries({ queryKey: ['favorites'] }),
                );
              }}
            >
              Save preview
            </Button>
          ) : (
            <Button asChild className="h-11" variant="outline">
              <Link href={`/login?next=/casino/game/${current.id}`}>Sign in to save</Link>
            </Button>
          )}
          <Button asChild variant="ghost" className="h-11">
            <Link href="/casino">Back to lobby</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
