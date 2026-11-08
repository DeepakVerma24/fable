'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { ErrorState, LoadingSkeleton } from '@/components/states';
import { WalletSummary } from '@/components/wallet-summary';
import { api } from '@/lib/api-client';
import { formatFbu } from '@/lib/money';
import type { DemoBet, WalletSummary as WalletData } from '@/lib/types';

export default function WalletPage() {
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => api<WalletData>('/wallet') });
  const bets = useQuery({
    queryKey: ['bets'],
    queryFn: () => api<{ items: DemoBet[] }>('/demo/bets'),
  });

  if (wallet.isLoading) return <LoadingSkeleton />;
  if (wallet.isError || !wallet.data) {
    return (
      <ErrorState
        body="The wallet could not be read from the ledger."
        onRetry={() => void wallet.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Wallet</p>
        <h1 className="text-2xl font-semibold tracking-tight">Demo balance</h1>
      </header>
      <WalletSummary wallet={wallet.data} />
      <p className="text-sm">
        <Link href="/transactions" className="underline">
          Transaction history
        </Link>
      </p>
      <Link href="/bets" className="inline-flex min-h-11 items-center text-sm underline">
        Full bet history and details →
      </Link>
      <section>
        <h2 className="mb-2 text-sm font-semibold">Recent demo bets</h2>
        {bets.isLoading ? <LoadingSkeleton /> : null}
        {bets.isError ? (
          <ErrorState body="Bet history did not load." onRetry={() => void bets.refetch()} />
        ) : null}
        {bets.data && bets.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No demo bets yet. The sportsbook slip is the only way to move a stake.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {bets.data?.items.map((bet) => (
              <li key={bet.id} className="px-3 py-3 text-sm">
                <p className="font-medium">
                  {bet.selectionName} ·{' '}
                  {bet.status === 'settled'
                    ? bet.outcome === 'win'
                      ? 'Demo win'
                      : 'Demo loss'
                    : bet.status}
                </p>
                <p className="text-muted-foreground">
                  {bet.eventName} · stake {formatFbu(bet.stakeMinor)} · return{' '}
                  {formatFbu(bet.payoutMinor)}
                </p>
                <p className="text-xs text-faint">{bet.note}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
