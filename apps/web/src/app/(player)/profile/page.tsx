'use client';

import Link from 'next/link';

import { useSession } from '@/components/shell/use-session';
import { ErrorState, LoadingSkeleton } from '@/components/states';

export default function ProfilePage() {
  const session = useSession();
  if (session.isLoading) return <LoadingSkeleton rows={2} />;
  if (session.isError || !session.data?.player) {
    return <ErrorState body="Sign in to see this profile." />;
  }
  const player = session.data.player;
  return (
    <div className="max-w-lg space-y-4">
      <header>
        <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Player</p>
        <h1 className="text-2xl font-semibold tracking-tight">{player.displayName}</h1>
      </header>
      <dl className="rounded-lg border border-border text-sm">
        <Row label="Email" value={player.email} />
        <Row label="Player id" value={player.id} />
        <Row label="Joined" value={formatWhen(player.createdAt)} />
        <Row label="Session ends" value={formatWhen(session.data.expiresAt)} />
      </dl>
      <Link href="/settings" className="inline-flex h-11 items-center text-sm underline">
        Edit display name
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-3 py-3 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right break-all">{value}</dd>
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Calcutta',
  }).format(new Date(iso));
}
