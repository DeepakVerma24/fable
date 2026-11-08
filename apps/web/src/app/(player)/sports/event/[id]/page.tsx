'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { MatchCentre } from '@/components/sports/match-centre';
import { competitionHref, eventPhaseLabel } from '@/lib/sports';
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
    queryFn: () => api<DemoEvent>(`/sports/events/${encodeURIComponent(id)}`),
    refetchInterval: 30_000,
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
    return (
      <ErrorState
        title="Fixture unavailable"
        body="The event could not be loaded. It may have left the demo board."
        onRetry={() => void event.refetch()}
      />
    );
  }

  const current = event.data;

  return (
    <article className="space-y-4">
      <header>
        <Link
          href={competitionHref(current.sport, current.competition)}
          className="text-xs text-muted-foreground underline"
        >
          {current.competition}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{current.name}</h1>
          <Badge variant="outline">{eventPhaseLabel(current.phase)}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{current.scheduleLabel}</p>
        <p className="mt-2 text-sm text-faint">
          Prices below are demo decimals. Suspended markets cannot be added to the slip.
        </p>
      </header>
      <MatchCentre event={current} />
      <h2 className="section-heading">Demo markets</h2>
      <p className="text-sm text-faint">
        Open prices support simulated singles only. Settlement uses a fixed selection-ID rule; it
        does not grade a real match.
      </p>
      {[...new Set(current.markets.map((market) => market.group ?? 'Main markets'))].map(
        (group) => (
          <details
            key={group}
            open={group === 'Main markets'}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">
              {group}
            </summary>
            {current.markets
              .filter((market) => (market.group ?? 'Main markets') === group)
              .map((market) => (
                <MarketGroup key={market.id} event={current} market={market} />
              ))}
          </details>
        ),
      )}
      {current.markets.length === 0 ? <p>No markets supplied for this fixture.</p> : null}
    </article>
  );
}
