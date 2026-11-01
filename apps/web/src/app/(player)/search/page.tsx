'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states';
import { api } from '@/lib/api-client';
import type { SearchHit } from '@/lib/types';

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SearchResults />
    </Suspense>
  );
}

function SearchResults() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const results = useQuery({
    queryKey: ['search-page', q],
    queryFn: () => api<{ items: SearchHit[] }>(`/search?q=${encodeURIComponent(q)}`),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          {q ? `Results for “${q}”` : 'Type a preview or a fixture name.'}
        </p>
      </header>
      {results.isLoading ? <LoadingSkeleton /> : null}
      {results.isError ? (
        <ErrorState body="Search failed." onRetry={() => void results.refetch()} />
      ) : null}
      {results.data && results.data.items.length === 0 ? (
        <EmptyState
          title="No matches"
          body="The demo catalog is small. Try Harbor, Northline, or Football."
        />
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {results.data?.items.map((hit) => (
          <li key={`${hit.kind}-${hit.id}`}>
            <Link
              href={hit.href}
              className="flex min-h-11 flex-col justify-center px-3 py-2 hover:bg-accent"
            >
              <span className="text-sm">{hit.title}</span>
              <span className="text-xs text-faint">{hit.subtitle}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
