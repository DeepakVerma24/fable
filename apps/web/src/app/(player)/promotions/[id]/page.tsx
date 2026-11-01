'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { ErrorState, LoadingSkeleton } from '@/components/states';
import { api } from '@/lib/api-client';
import type { DemoPromotion } from '@/lib/types';

export default function PromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const promotion = useQuery({
    queryKey: ['promotion', id],
    queryFn: () => api<DemoPromotion>(`/promotions/${id}`),
  });

  if (promotion.isLoading) return <LoadingSkeleton rows={2} />;
  if (promotion.isError || !promotion.data) {
    return <ErrorState title="Promotion missing" body="That offer is not in the demo list." />;
  }

  const current = promotion.data;
  return (
    <article className="max-w-xl space-y-3">
      <Link href="/promotions" className="text-xs text-muted-foreground underline">
        All promotions
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
      <p className="text-sm text-muted-foreground">{current.detail}</p>
      <p className="rounded-md border border-border p-3 text-sm">{current.terms}</p>
    </article>
  );
}
