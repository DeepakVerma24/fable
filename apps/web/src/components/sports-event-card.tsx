'use client';

import Link from 'next/link';

import { OddsButton } from '@/components/odds-button';
import { Badge } from '@/components/ui/badge';
import { selectionAvailable, eventPhaseLabel, competitionHref, formatOvers } from '@/lib/sports';
import { useBetSlip } from '@/lib/bet-slip';
import type { DemoEvent } from '@/lib/types';

export function SportsEventCard({ event }: { event: DemoEvent }) {
  const selections = useBetSlip((state) => state.selections);
  const toggle = useBetSlip((state) => state.toggle);
  const market = event.markets[0];

  return (
    <article className="sports-event-row rounded-lg border border-border bg-card px-3 py-3">
      <div className="event-information mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] tracking-wide text-faint uppercase">
            <Link
              href={competitionHref(event.sport, event.competition)}
              className="hover:underline"
            >
              {event.competition}
            </Link>
          </p>
          <h3 className="truncate text-sm font-medium">
            <Link href={`/sports/event/${event.id}`} className="hover:underline">
              {event.name}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">{event.scheduleLabel}</p>
        </div>
        <Badge variant="outline">{eventPhaseLabel(event.phase)}</Badge>
      </div>
      {event.cricket ? (
        <p className="mb-2 text-xs text-muted-foreground">
          {event.cricket.format} ·{' '}
          {event.cricket.innings
            .map(
              (innings) =>
                `${innings.team} ${innings.runs}/${innings.wickets} (${formatOvers(innings.legalBalls)})`,
            )
            .join(' · ') || 'Innings not started'}
        </p>
      ) : null}
      {event.score ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Simulated score: {event.score.values.join(' – ')} · {event.score.detail}
        </p>
      ) : null}
      {market ? (
        <div className="event-odds flex gap-1.5">
          {market.selections.map((item) => (
            <OddsButton
              key={item.id}
              name={item.name}
              decimalOdds={item.decimalOdds}
              suspended={!selectionAvailable(event, market, item)}
              closed={event.phase === 'completed' || market.status === 'closed'}
              selected={selections.some((selection) => selection.selectionId === item.id)}
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
