'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/shell/use-session';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states';
import { api } from '@/lib/api-client';
import { formatFbu } from '@/lib/money';
import type { DemoBet } from '@/lib/types';

export function BetHistory({ betId }: { betId?: string }) {
  const session = useSession();
  const playerId = session.data?.player.id;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [outcome, setOutcome] = useState('');
  const [sort, setSort] = useState('newest');
  const bets = useQuery({
    queryKey: ['bets', playerId],
    queryFn: () => api<{ items: DemoBet[] }>('/demo/bets'),
    enabled: Boolean(playerId),
  });
  if (session.isLoading || (playerId && bets.isLoading)) return <LoadingSkeleton />;
  if (session.isError || bets.isError)
    return (
      <ErrorState
        body="Bet history could not be loaded."
        onRetry={() => {
          void session.refetch();
          void bets.refetch();
        }}
      />
    );
  if (!playerId)
    return (
      <p>
        <Link href="/login?next=/bets" className="underline">
          Log in to view your demo bets
        </Link>
      </p>
    );
  if (betId) {
    const bet = bets.data?.items.find((item) => item.id === betId);
    if (!bet)
      return (
        <EmptyState
          title="Bet not found"
          body="This bet is not in your account's available history."
        />
      );
    return (
      <article className="space-y-4">
        <Link href="/bets" className="inline-flex min-h-11 items-center text-sm underline">
          All demo bets
        </Link>
        <h1 className="section-heading">Demo bet details</h1>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xl font-[Georgia]">{bet.selectionName}</h2>
          <p className="mt-2 text-sm">
            {bet.eventName} · {bet.marketName}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <Fact label="Status" value={bet.status} />
            <Fact
              label="Outcome"
              value={bet.status === 'settled' ? `Demo ${bet.outcome}` : 'Not a final sports result'}
            />
            <Fact label="Stake" value={formatFbu(bet.stakeMinor)} />
            <Fact label="Return / recorded payout" value={formatFbu(bet.payoutMinor)} />
            <Fact label="Decimal odds" value={bet.decimalOdds} />
            <Fact label="Placed" value={new Date(bet.createdAt).toLocaleString()} />
            <Fact label="Reference" value={bet.id} />
            <Fact label="Settlement source" value={bet.outcomeSource} />
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">{bet.note}</p>
        </div>
        <p className="text-sm text-faint">Simulated FBU only. No real money or cash value.</p>
        <Link
          className="inline-flex min-h-11 items-center text-sm underline"
          href={`/sports/event/${encodeURIComponent(bet.eventId)}`}
        >
          View fixture
        </Link>
      </article>
    );
  }
  const items = (bets.data?.items ?? [])
    .filter(
      (bet) =>
        (!status || bet.status === status) &&
        (!outcome || (bet.status === 'settled' && bet.outcome === outcome)) &&
        `${bet.eventName} ${bet.selectionName} ${bet.id}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'oldest'
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <section className="space-y-4">
      <h1 className="section-heading">My demo bets</h1>
      <p className="text-sm text-faint">
        Account history from the simulated backend. Results use a fixed rule, not actual sporting
        outcomes.
      </p>
      <div className="sports-filters">
        <label>
          Search bets
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Team, selection or reference"
          />
        </label>
        <label>
          Bet status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['accepted', 'settled', 'cancelled', 'refunded'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Outcome
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">All outcomes</option>
            <option value="win">Demo win</option>
            <option value="loss">Demo loss</option>
          </select>
        </label>
        <label>
          Sort bets
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      <button className="sports-filter" onClick={() => void bets.refetch()}>
        Refresh history
      </button>
      {items.length ? (
        <ul className="space-y-3">
          {items.map((bet) => (
            <li key={bet.id} className="rounded-lg border border-border bg-card p-4 text-sm">
              <Link
                href={`/bets/${encodeURIComponent(bet.id)}`}
                className="inline-flex min-h-11 items-center font-medium underline"
              >
                {bet.selectionName} ·{' '}
                {bet.status === 'settled' ? `Demo ${bet.outcome}` : bet.status}
              </Link>
              <p className="text-muted-foreground">
                {bet.eventName} · {bet.marketName}
              </p>
              <p className="mt-2 tabular-nums">
                Stake {formatFbu(bet.stakeMinor)} · Return {formatFbu(bet.payoutMinor)}
              </p>
              <p className="mt-1 text-xs text-faint">{new Date(bet.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No demo bets found"
          body="Try another filter or place a simulated single from the sportsbook."
        />
      )}
    </section>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
