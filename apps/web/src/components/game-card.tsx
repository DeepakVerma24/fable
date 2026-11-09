import type { ReactNode } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';

import { PreviewMark } from '@/components/preview-mark';
import { Badge } from '@/components/ui/badge';
import type { DemoGame } from '@/lib/types';

export function GameCard({
  game,
  favorited = false,
  onFavorite,
  favoritePending = false,
}: {
  game: Pick<DemoGame, 'id' | 'name' | 'categories' | 'provider' | 'summary'> &
    Partial<Pick<DemoGame, 'playable'>>;
  favoritePending?: boolean;
  favorited?: boolean;
  onFavorite?: () => void;
}) {
  return (
    <article className="game-card overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary">
      <Link
        href={`/casino/game/${game.id}`}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <PreviewMark seed={game.id} label="" />
        <div className="game-caption space-y-1 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium tracking-tight">{game.name}</h3>
            <Badge variant="outline">{game.playable ? 'Practice demo' : 'Preview'}</Badge>
          </div>
          <p className="sr-only">{game.provider}</p>
          <p className="sr-only">{game.summary}</p>
        </div>
      </Link>
      {onFavorite ? (
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-pressed={favorited}
            disabled={favoritePending}
            aria-label={`${favorited ? 'Remove' : 'Save'} ${game.name}${favorited ? ' from favorites' : ' to favorites'}`}
            onClick={onFavorite}
          >
            <Star className={favorited ? 'size-3.5 fill-current' : 'size-3.5'} aria-hidden />
            {favorited ? 'Saved' : 'Save'}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function GameGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;
}
