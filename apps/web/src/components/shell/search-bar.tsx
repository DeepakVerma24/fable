'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { api } from '@/lib/api-client';
import type { SearchHit } from '@/lib/types';

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const results = useQuery({
    queryKey: ['search', debounced],
    enabled: debounced.length > 0,
    queryFn: () => api<{ items: SearchHit[] }>(`/search?q=${encodeURIComponent(debounced)}`),
  });

  return (
    <form
      className={compact ? 'relative w-full' : 'relative hidden min-w-0 flex-1 md:block'}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (!query.trim()) return;
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }}
    >
      <label htmlFor={compact ? 'search-compact' : 'search-global'} className="sr-only">
        Search games and fixtures
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <input
        id={compact ? 'search-compact' : 'search-global'}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search previews and fixtures"
        className="h-11 w-full rounded-md border border-border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-white"
      />
      {open && debounced ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {(results.data?.items ?? []).length === 0 && !results.isLoading ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No demo matches.</p>
          ) : (
            <ul>
              {(results.data?.items ?? []).map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link
                    href={hit.href}
                    className="block px-3 py-2 hover:bg-accent"
                    onClick={() => setOpen(false)}
                  >
                    <span className="block text-sm">{hit.title}</span>
                    <span className="block text-xs text-faint">{hit.subtitle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </form>
  );
}
