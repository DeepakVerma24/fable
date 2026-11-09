'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SportsEventCard } from '@/components/sports-event-card';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states';
import { api } from '@/lib/api-client';
import { competitionHref, eventPhaseLabel, filterEvents, loadEvents } from '@/lib/sports';
import type { DemoSport } from '@/lib/types';

export function SportsBrowser({ sport, competition }: { sport?: string; competition?: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const sports = useQuery({
    queryKey: ['sports'],
    queryFn: () => api<{ items: DemoSport[] }>('/sports'),
  });
  const events = useQuery({
    queryKey: ['sports-board', sport ?? 'all'],
    queryFn: () => loadEvents(sport),
    refetchInterval: 30_000,
  });
  const current = sports.data?.items.find((item) => item.slug === sport);
  const filters = {
    search: params.get('q') ?? '',
    competition: competition ?? params.get('competition') ?? '',
    phase: params.get('phase') ?? '',
    format: params.get('format') ?? '',
    sort: params.get('sort') ?? 'popular',
  };
  const filtered = filterEvents(events.data ?? [], filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8));
  const page = Math.min(pageCount, Math.max(1, Number(params.get('page')) || 1));
  const visible = filtered.slice((page - 1) * 8, page * 8);
  const competitions = current?.competitions ?? [
    ...new Set(sports.data?.items.flatMap((item) => item.competitions) ?? []),
  ];
  function update(key: string, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    window.history.replaceState(null, '', `${pathname}?${next.toString()}`);
  }
  return (
    <div className="sports-browser space-y-5">
      <header>
        <p className="text-xs tracking-widest text-faint uppercase">FABLE Sportsbook</p>
        <h1 className="section-heading mt-1">
          {competition ?? current?.name ?? (sport ? 'Sport' : 'Sportsbook')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Simulated fixtures and frozen scores only. No live feed. Demo bets settle by a fixed rule,
          not a sports result.
        </p>
        <Link href="/bets" className="inline-flex min-h-11 items-center text-sm underline">
          My demo bets →
        </Link>
      </header>
      <nav aria-label="Sports" className="flex flex-wrap gap-2">
        <Link href="/sports" className="sports-filter" aria-current={!sport ? 'page' : undefined}>
          All sports
        </Link>
        {sports.data?.items.map((item) => (
          <Link
            key={item.slug}
            href={`/sports/${item.slug}`}
            className="sports-filter"
            aria-current={sport === item.slug ? 'page' : undefined}
          >
            {item.name}
          </Link>
        ))}
      </nav>
      {sports.isError ? (
        <ErrorState body="Sports navigation did not load." onRetry={() => void sports.refetch()} />
      ) : null}
      {sport && current ? (
        <details className="rounded-lg border border-border bg-card p-3">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
            Competitions · {current.competitions.length}
          </summary>
          <p className="mb-3 text-xs text-faint">
            Named competitions are configured categories only. No actual fixtures or provider
            coverage is implied.
          </p>
          <nav aria-label="Competitions" className="flex flex-wrap gap-2">
            {current.competitions.map((name) => (
              <Link
                key={name}
                className="sports-filter"
                href={competitionHref(sport, name)}
                aria-current={name === competition ? 'page' : undefined}
              >
                {name}
              </Link>
            ))}
          </nav>
        </details>
      ) : null}
      <div className="sports-filters">
        <label>
          Search events
          <input
            type="search"
            value={filters.search}
            onChange={(e) => update('q', e.target.value)}
            placeholder="Teams or competition"
          />
        </label>
        {!competition ? (
          <label>
            Competition
            <select
              aria-label="Competition"
              value={filters.competition}
              onChange={(e) => update('competition', e.target.value)}
            >
              <option value="">All competitions</option>
              {competitions.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Event status
          <select
            aria-label="Event status"
            value={filters.phase}
            onChange={(e) => update('phase', e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="upcoming">Upcoming (demo)</option>
            <option value="demo-live">Live (simulated)</option>
            <option value="completed">Completed (demo)</option>
          </select>
        </label>
        {!sport || sport === 'cricket' ? (
          <label>
            Cricket format
            <select
              aria-label="Cricket format"
              value={filters.format}
              onChange={(e) => update('format', e.target.value)}
            >
              <option value="">All formats</option>
              {['T20', 'ODI', 'Test', 'T10', 'Other'].map((format) => (
                <option key={format}>{format}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Sort events
          <select
            aria-label="Sort events"
            value={filters.sort}
            onChange={(e) => update('sort', e.target.value)}
          >
            <option value="time">Scheduled time</option>
            <option value="name">Name A–Z</option>
            <option value="popular">Featured first</option>
          </select>
        </label>
      </div>
      {competition ? (
        <Link
          href={`/sports/${sport}`}
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          All {current?.name ?? ''} competitions
        </Link>
      ) : null}
      {events.isLoading ? (
        <LoadingSkeleton />
      ) : events.isError ? (
        <ErrorState
          body="Fixtures did not load. Please retry."
          onRetry={() => void events.refetch()}
        />
      ) : (
        <>
          <p role="status" className="text-xs text-faint">
            {filtered.length} simulated fixtures found
          </p>
          {filtered.length === 0 ? (
            <EmptyState
              title="No fixtures available"
              body="No matching simulated fixtures. No live provider data is available."
            />
          ) : null}
          {(['upcoming', 'demo-live', 'completed'] as const)
            .filter(
              (phase) =>
                (!filters.phase || phase === filters.phase) &&
                visible.some((event) => event.phase === phase),
            )
            .map((phase) => (
              <section key={phase} className="space-y-3">
                <h2 className="text-xl font-[Georgia]">{eventPhaseLabel(phase)}</h2>
                {visible.some((event) => event.phase === phase) ? (
                  visible
                    .filter((event) => event.phase === phase)
                    .map((event) => <SportsEventCard key={event.id} event={event} />)
                ) : (
                  <EmptyState
                    title="No fixtures available"
                    body="No matching simulated fixtures on this page. No live provider data is available."
                  />
                )}
              </section>
            ))}
          {pageCount > 1 ? (
            <nav aria-label="Event pages" className="flex items-center justify-between gap-2">
              <button
                className="sports-filter"
                disabled={page <= 1}
                onClick={() => update('page', String(page - 1))}
              >
                Previous
              </button>
              <span className="text-sm">
                Page {page} of {pageCount}
              </span>
              <button
                className="sports-filter"
                disabled={page >= pageCount}
                onClick={() => update('page', String(page + 1))}
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
