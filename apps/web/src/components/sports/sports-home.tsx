'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { SportsEventCard } from '@/components/sports-event-card';
import { ErrorState, LoadingSkeleton } from '@/components/states';
import { api } from '@/lib/api-client';
import type { DemoEvent, DemoSport, Page } from '@/lib/types';

export function SportsHome() {
  const params = useSearchParams();
  const phase = params.get('phase') === 'demo-live' ? 'demo-live' : '';
  const sports = useQuery({
    queryKey: ['sports'],
    queryFn: () => api<{ items: DemoSport[]; liveFeed: false }>('/sports'),
  });
  const events = useQuery({
    queryKey: ['events', phase || 'all'],
    queryFn: () =>
      api<Page<DemoEvent>>(`/sports/events?pageSize=24${phase ? `&phase=${phase}` : ''}`),
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Sportsbook</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {phase ? 'Demo in-play' : 'Fixtures'}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Decimal prices are part of the demo catalog. They do not update from a live feed.
        </p>
      </header>
      <nav aria-label="Sports" className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/sports"
          className="inline-flex h-11 shrink-0 items-center rounded-md border border-border px-3 text-sm"
        >
          All
        </Link>
        {sports.data?.items.map((sport) => (
          <Link
            key={sport.slug}
            href={`/sports/${sport.slug}`}
            className="inline-flex h-11 shrink-0 items-center rounded-md border border-border px-3 text-sm"
          >
            {sport.name}
          </Link>
        ))}
      </nav>
      {events.isLoading ? <LoadingSkeleton /> : null}
      {events.isError ? (
        <ErrorState body="Fixtures did not load." onRetry={() => void events.refetch()} />
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {events.data?.items.map((event) => (
          <SportsEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
