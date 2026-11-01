import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import type { DemoPromotion } from '@/lib/types';

export function PromotionCard({ promotion }: { promotion: DemoPromotion }) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <Badge variant="outline" className="w-fit">
        Demo · no cash value
      </Badge>
      <h3 className="mt-3 text-sm font-semibold">{promotion.title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{promotion.summary}</p>
      <Link
        href={`/promotions/${promotion.id}`}
        className="mt-3 text-sm font-medium underline-offset-4 hover:underline"
      >
        Read terms
      </Link>
    </article>
  );
}
