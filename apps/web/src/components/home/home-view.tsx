'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { GameCard, GameGrid } from '@/components/game-card';
import { PromotionCard } from '@/components/promotion-card';
import { SportsEventCard } from '@/components/sports-event-card';
import { EmptyState, ErrorState, LoadingSkeleton, SectionHeader } from '@/components/states';
import { api } from '@/lib/api-client';
import { useRecent } from '@/lib/recent';
import type { DemoEvent, DemoGame, DemoPromotion, Page } from '@/lib/types';

export function HomeView() {
  const featuredGames = useQuery({
    queryKey: ['games', 'featured'],
    queryFn: () => api<Page<DemoGame>>('/casino/games?sort=featured&pageSize=4'),
  });
  const recommended = useQuery({
    queryKey: ['games', 'recommended'],
    queryFn: () => api<Page<DemoGame>>('/casino/games?pageSize=8'),
  });
  const popular = useQuery({
    queryKey: ['events', 'popular'],
    queryFn: () => api<Page<DemoEvent>>('/sports/events?pageSize=4'),
  });
  const live = useQuery({
    queryKey: ['events', 'demo-live'],
    queryFn: () => api<Page<DemoEvent>>('/sports/events?phase=demo-live&pageSize=4'),
  });
  const promotions = useQuery({
    queryKey: ['promotions'],
    queryFn: () => api<{ items: DemoPromotion[] }>('/promotions'),
  });
  const recent = useRecent();
  const failed = [featuredGames, popular, live, promotions].find((query) => query.isError);

  return (
    <div className="home-editorial space-y-7">
      <header className="editorial-hero">
        <div className="hero-copy">
          <p className="hero-eyebrow">SPORTSBOOK &amp; CASINO</p>
          <h1 aria-label="FABLE">
            A different
            <br />
            class of play.
          </h1>
          <p className="hero-intro">
            Discover a considered collection of casino previews and sporting fixtures.
          </p>
          <Link href="/sports" className="hero-action">
            Explore Sports <span aria-hidden>→</span>
          </Link>
          <p className="hero-disclosure">
            Simulated Fable demo units. No real-money transactions.
            <br />
            Demo odds are not live prices.
          </p>
        </div>
      </header>

      {failed ? (
        <ErrorState
          body="The lobby could not reach the API."
          onRetry={() => void failed.refetch()}
        />
      ) : null}

      <section>
        <SectionHeader
          eyebrow="Casino"
          title="Featured Casino Games"
          action={
            <Link href="/casino" className="text-sm underline">
              View all games →
            </Link>
          }
        />
        {featuredGames.isLoading ? <LoadingSkeleton /> : null}
        <GameGrid>
          {featuredGames.data?.items.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </GameGrid>
      </section>

      <section>
        <SectionHeader
          eyebrow="Board"
          title="Sports fixtures"
          action={
            <Link href="/sports" className="text-sm underline">
              Sportsbook
            </Link>
          }
        />
        {popular.data?.items.length === 0 ? (
          <EmptyState
            title="No fixtures available"
            body="Please check back for the next demo board."
          />
        ) : null}
        {popular.isLoading ? <LoadingSkeleton rows={2} /> : null}
        <div className="sports-rows grid gap-2">
          {popular.data?.items.map((event) => (
            <SportsEventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow="Simulated"
          title="Demo in-play"
          action={
            <Link href="/sports?phase=demo-live" className="text-sm underline">
              All demo in-play
            </Link>
          }
        />
        {live.isLoading ? <LoadingSkeleton rows={2} /> : null}
        <p className="mb-3 text-xs text-faint">
          A label, not a broadcast. These clocks do not come from a feed.
        </p>
        <div className="sports-rows grid gap-2">
          {live.data?.items.map((event) => (
            <SportsEventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Categories" />
        <div className="flex flex-wrap gap-2">
          {[
            ['slots', 'Slots'],
            ['live', 'Live Casino'],
            ['table', 'Table Games'],
            ['originals', 'Originals'],
            ['new', 'New'],
            ['popular', 'Popular'],
          ].map(([slug, label]) => (
            <Link
              key={slug}
              href={
                slug === 'slots' || slug === 'live'
                  ? `/casino/${slug === 'live' ? 'live' : 'slots'}`
                  : `/casino?category=${slug}`
              }
              className="inline-flex h-11 items-center rounded-md border border-border px-3 text-sm hover:bg-accent"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Recommended previews" />
        <GameGrid>
          {recommended.data?.items
            .filter((game) => game.recommended)
            .slice(0, 4)
            .map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
        </GameGrid>
      </section>

      <section>
        <SectionHeader
          title="Promotions"
          action={
            <Link href="/promotions" className="text-sm underline">
              All
            </Link>
          }
        />
        <div className="grid gap-3 md:grid-cols-3">
          {promotions.data?.items.map((promotion) => (
            <PromotionCard key={promotion.id} promotion={promotion} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Recently viewed" />
        {recent.length === 0 ? (
          <EmptyState
            title="Nothing viewed yet"
            body="Open a preview or a fixture. This list stays in this browser tab."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center justify-between px-3 text-sm hover:bg-accent"
                >
                  <span>{item.title}</span>
                  <span className="text-xs text-faint">
                    {item.kind === 'game' ? 'Preview' : 'Fixture'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
