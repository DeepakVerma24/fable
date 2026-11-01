'use client';

import { useQuery } from '@tanstack/react-query';

import { PromotionCard } from '@/components/promotion-card';
import { ErrorState, LoadingSkeleton } from '@/components/states';
import { api } from '@/lib/api-client';
import type { DemoPromotion } from '@/lib/types';

export default function PromotionsPage() {
  const promotions = useQuery({
    queryKey: ['promotions'],
    queryFn: () => api<{ items: DemoPromotion[] }>('/promotions'),
  });

  if (promotions.isLoading) return <LoadingSkeleton />;
  if (promotions.isError || !promotions.data) {
    return <ErrorState body="Promotions did not load." onRetry={() => void promotions.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Offers</p>
        <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Every offer on this page has no cash value. The opening balance is the only credit, and it
          is demo units.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        {promotions.data.items.map((promotion) => (
          <PromotionCard key={promotion.id} promotion={promotion} />
        ))}
      </div>
    </div>
  );
}
