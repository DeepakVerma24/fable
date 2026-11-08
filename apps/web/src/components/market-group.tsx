'use client';

import { OddsButton } from '@/components/odds-button';
import { selectionAvailable } from '@/lib/sports';
import { useBetSlip } from '@/lib/bet-slip';
import type { DemoEvent, DemoMarket } from '@/lib/types';

export function MarketGroup({ event, market }: { event: DemoEvent; market: DemoMarket }) {
  const selections = useBetSlip((state) => state.selections);
  const toggle = useBetSlip((state) => state.toggle);
  return (
    <details
      open={market.status !== 'unavailable'}
      className="rounded-lg border border-border bg-card p-3"
    >
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
        {market.name} · {event.phase === 'completed' ? 'Closed' : (market.status ?? 'open')}
      </summary>
      {market.unavailableReason ? (
        <p className="mb-2 text-xs text-faint">{market.unavailableReason}</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
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
    </details>
  );
}
