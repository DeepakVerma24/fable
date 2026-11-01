'use client';

import { OddsButton } from '@/components/odds-button';
import { useBetSlip } from '@/lib/bet-slip';
import type { DemoEvent, DemoMarket } from '@/lib/types';

export function MarketGroup({ event, market }: { event: DemoEvent; market: DemoMarket }) {
  const selection = useBetSlip((state) => state.selection);
  const toggle = useBetSlip((state) => state.toggle);
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <h3 className="mb-2 text-sm font-medium">{market.name}</h3>
      <div className="flex flex-wrap gap-1.5">
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
    </section>
  );
}
