'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { MarketGroup } from '@/components/market-group';
import { ErrorState, LoadingSkeleton } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { rememberRecent } from '@/lib/recent';
import type { DemoEvent } from '@/lib/types';

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const event = useQuery({
    queryKey: ['event', id],
    queryFn: () => api<DemoEvent>(`/sports/events/${id}`),
  });

  useEffect(() => {
    if (!event.data) return;
    rememberRecent({
      kind: 'event',
      id: event.data.id,
      title: event.data.name,
      href: `/sports/event/${event.data.id}`,
    });
  }, [event.data]);

  if (event.isLoading) return <LoadingSkeleton />;
  if (event.isError || !event.data) {
    return <ErrorState title="Fixture missing" body="That event is not on the demo board." />;
  }

  const current = event.data;

  return (
    <article className="space-y-4">
      <header>
        <Link href={`/sports/${current.sport}`} className="text-xs text-muted-foreground underline">
          {current.competition}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{current.name}</h1>
          <Badge variant="outline">
            {current.phase === 'demo-live' ? 'Demo in-play' : 'Fixture'}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{current.scheduleLabel}</p>
        <p className="mt-2 text-sm text-faint">
          Prices below are demo decimals. Suspended markets cannot be added to the slip.
        </p>
      </header>
      <div className="grid gap-3">
        {current.markets.map((market) => (
          <MarketGroup key={market.id} event={current} market={market} />
        ))}
      </div>
    </article>
  );
}
