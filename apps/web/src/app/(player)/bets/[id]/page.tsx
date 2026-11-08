'use client';
import { use } from 'react';
import { BetHistory } from '@/components/sports/bet-history';
export default function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BetHistory betId={id} />;
}
