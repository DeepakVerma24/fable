'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { Menu, Receipt, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BetSlip } from '@/components/bet-slip';
import { DemoBalance } from '@/components/wallet-summary';
import { headerItems, isActive, sidebarItems } from '@/components/shell/nav';
import { Notifications } from '@/components/shell/notifications';
import { SearchBar } from '@/components/shell/search-bar';
import { useSession, useWallet } from '@/components/shell/use-session';
import { UserMenu } from '@/components/shell/user-menu';
import { PENDING_STORAGE_KEY, SLIP_STORAGE_KEY, useBetSlip } from '@/lib/bet-slip';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const draftCount = useBetSlip((state) => state.selections.length);
  useEffect(() => {
    useBetSlip.getState().hydrate();
    const sync = (event: StorageEvent) => {
      if (event.key === SLIP_STORAGE_KEY || event.key === PENDING_STORAGE_KEY)
        useBetSlip.getState().hydrate();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const session = useSession();
  const signedIn = Boolean(session.data?.player);
  const wallet = useWallet(signedIn);
  const [drawer, setDrawer] = useState(false);
  const slipOpen = useBetSlip((state) => state.open);
  const setSlipOpen = useBetSlip((state) => state.setOpen);
  const showRail = pathname === '/' || pathname.startsWith('/sports');

  return (
    <div
      className={cn(
        'app-shell min-h-dvh bg-background',
        pathname === '/' && 'shell-home',
        showRail && 'shell-with-rail',
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="topbar-inner mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 md:px-4">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md border border-border lg:hidden"
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
          >
            <Menu className="size-4" aria-hidden />
          </button>
          <Link href="/" className="fable-wordmark">
            FABLE
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {headerItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex h-9 items-center rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground',
                  isActive(pathname, item.href) && 'bg-accent text-foreground',
                )}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <SearchBar />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/wallet"
              className="hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:block"
            >
              <DemoBalance availableMinor={wallet.data?.availableMinor} signedIn={signedIn} />
            </Link>
            <Notifications />
            <UserMenu player={session.data?.player ?? null} />
          </div>
        </div>
        <div className="border-t border-border px-3 py-2 md:hidden">
          <SearchBar compact />
        </div>
      </header>

      <div
        className={cn(
          'shell-grid mx-auto grid max-w-[1600px] lg:grid-cols-[13.5rem_minmax(0,1fr)]',
          showRail && 'xl:grid-cols-[13.5rem_minmax(0,1fr)_20rem]',
        )}
      >
        <aside className="left-sidebar sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto border-r border-border px-2 py-3 lg:block">
          <SideLinks pathname={pathname} onNavigate={() => undefined} />
        </aside>
        <main id="main" className="min-w-0 px-4 pt-4 pb-24 md:px-6 lg:pb-8">
          {children}
        </main>
        {showRail ? (
          <aside className="bet-rail sticky top-20 hidden self-start p-4 xl:block">
            <div className="slip-panel">
              <h2 className="slip-title">
                Bet Slip <span>Demo · singles only</span>
              </h2>
              <BetSlip signedIn={signedIn} playerId={session.data?.player.id} />
            </div>
          </aside>
        ) : null}
      </div>

      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background xl:hidden"
      >
        <MobileLink href="/" label="Home" active={pathname === '/'} />
        <MobileLink href="/casino" label="Casino" active={pathname.startsWith('/casino')} />
        <MobileLink href="/sports" label="Sports" active={pathname.startsWith('/sports')} />
        <button
          type="button"
          className="flex min-h-14 flex-col items-center justify-center text-[11px]"
          onClick={() => setSlipOpen(true)}
        >
          <Receipt className="mb-0.5 size-4" aria-hidden />
          Slip ({draftCount})
        </button>
        <MobileLink href="/wallet" label="Wallet" active={pathname.startsWith('/wallet')} />
      </nav>

      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="fixed top-0 left-0 z-50 overflow-y-auto flex h-dvh w-[min(100%,18rem)] flex-col border-r border-border bg-background p-3">
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold tracking-[0.18em]">FABLE</Dialog.Title>
              <Dialog.Close
                className="inline-flex size-11 items-center justify-center"
                aria-label="Close menu"
              >
                <X className="size-4" aria-hidden />
              </Dialog.Close>
            </div>
            <SideLinks pathname={pathname} onNavigate={() => setDrawer(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={slipOpen} onOpenChange={setSlipOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 xl:hidden" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-xl border border-border bg-background p-4 xl:hidden">
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold">Demo slip</Dialog.Title>
              <Dialog.Close className="min-h-11 px-3 text-sm text-muted-foreground">
                Close
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              Saved draft selections. Only simulated singles can be placed.
            </Dialog.Description>
            <BetSlip signedIn={signedIn} playerId={session.data?.player.id} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function SideLinks({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav aria-label="Sections" className="flex flex-col gap-0.5">
      {sidebarItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <div key={item.href}>
            {['/', '/casino', '/sports', '/favorites'].includes(item.href) ? (
              <p className="nav-group">
                {item.href === '/'
                  ? 'Discover'
                  : item.href === '/casino'
                    ? 'Casino'
                    : item.href === '/sports'
                      ? 'Sports'
                      : 'Your Fable'}
              </p>
            ) : null}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
                active && 'bg-accent text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function MobileLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-14 items-center justify-center text-[11px] text-muted-foreground',
        active && 'text-foreground',
      )}
    >
      {label}
    </Link>
  );
}
