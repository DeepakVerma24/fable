'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { SportsEventCard } from '@/components/sports-event-card';
import { ErrorState, LoadingSkeleton } from '@/components/states';
import { api } from '@/lib/api-client';
import type { DemoEvent, DemoSport, Page } from '@/lib/types';

export default function SportPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = use(params);
  const [competition, setCompetition] = useState('');
  const events = useQuery({
    queryKey: ['sport', sport, competition],
    queryFn: () => {
      const search = new URLSearchParams({ pageSize: '24' });
      if (competition) search.set('competition', competition);
      return api<Page<DemoEvent> & { sport: DemoSport }>(
        `/sports/${sport}/events?${search.toString()}`,
      );
    },
  });

  if (events.isLoading) return <LoadingSkeleton />;
  if (events.isError || !events.data) {
    return (
      <ErrorState title="Sport not on the board" body="That slug is not in the demo catalog." />
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <Link href="/sports" className="text-xs text-muted-foreground underline">
          All sports
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{events.data.sport.name}</h1>
        <p className="text-sm text-muted-foreground">Demo fixtures only.</p>
      </header>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Competitions">
        <Filter
          label="All competitions"
          pressed={competition === ''}
          onClick={() => setCompetition('')}
        />
        {events.data.sport.competitions.map((name) => (
          <Filter
            key={name}
            label={name}
            pressed={competition === name}
            onClick={() => setCompetition(name)}
          />
        ))}
      </div>
      <div className="grid gap-3">
        {events.data.items.map((event) => (
          <SportsEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

function Filter({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-11 items-center rounded-md border px-3 text-sm ${pressed ? 'border-white bg-white text-primary-foreground' : 'border-border'}`}
    >
      {label}
    </button>
  );
}
