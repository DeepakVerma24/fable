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
}: {
  game: Pick<DemoGame, 'id' | 'name' | 'categories' | 'provider' | 'summary'>;
  favorited?: boolean;
  onFavorite?: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-[#3a404a]">
      <Link
        href={`/casino/game/${game.id}`}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <PreviewMark seed={game.id} label="" />
        <div className="space-y-1 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium tracking-tight">{game.name}</h3>
            <Badge variant="outline">Preview</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{game.provider}</p>
          <p className="line-clamp-2 text-xs text-faint">{game.summary}</p>
        </div>
      </Link>
      {onFavorite ? (
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-pressed={favorited}
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
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</div>;
}
