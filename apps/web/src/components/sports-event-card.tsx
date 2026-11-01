'use client';

import Link from 'next/link';

import { OddsButton } from '@/components/odds-button';
import { Badge } from '@/components/ui/badge';
import { useBetSlip } from '@/lib/bet-slip';
import type { DemoEvent } from '@/lib/types';

export function SportsEventCard({ event }: { event: DemoEvent }) {
  const selection = useBetSlip((state) => state.selection);
  const toggle = useBetSlip((state) => state.toggle);
  const market = event.markets[0];

  return (
    <article className="rounded-lg border border-border bg-card px-3 py-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] tracking-wide text-faint uppercase">{event.competition}</p>
          <h3 className="truncate text-sm font-medium">
            <Link href={`/sports/event/${event.id}`} className="hover:underline">
              {event.name}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">{event.scheduleLabel}</p>
        </div>
        <Badge variant="outline">{event.phase === 'demo-live' ? 'Demo in-play' : 'Fixture'}</Badge>
      </div>
      {market ? (
        <div className="flex gap-1.5">
          {market.selections.map((item) => (
            <OddsButton
              key={item.id}
              name={item.name}
              decimalOdds={item.decimalOdds}
              suspended={item.suspended}
              selected={selection?.selectionId === item.id}
              onSelect={() =>
                toggle({
                  selectionId: item.id,
                  selectionName: item.name,
                  eventId: event.id,
                  eventName: event.name,
                  marketName: market.name,
                  decimalOdds: item.decimalOdds,
                  suspended: item.suspended,
                })
              }
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
