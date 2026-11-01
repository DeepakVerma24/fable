import Link from 'next/link';

import { PlayerLayout } from '@/components/shell/player-layout';

export default function NotFound() {
  return (
    <PlayerLayout>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        That address is not part of the player lobby. Nothing was charged, because nothing here
        moves real money.
      </p>
      <Link href="/" className="mt-4 inline-flex h-11 items-center text-sm font-medium underline">
        Back to discover
      </Link>
    </PlayerLayout>
  );
}
