import { formatFbu } from '@/lib/money';
import type { WalletSummary as WalletSummaryData } from '@/lib/types';

export function WalletSummary({ wallet }: { wallet: WalletSummaryData }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">
        {wallet.label}
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
        {formatFbu(wallet.availableMinor)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Available</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Reserved</dt>
          <dd className="font-medium tabular-nums">{formatFbu(wallet.reservedMinor)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Available + reserved</dt>
          <dd className="font-medium tabular-nums">{formatFbu(wallet.totalMinor)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-faint">{wallet.disclaimer}</p>
    </section>
  );
}

export function DemoBalance({
  availableMinor,
  signedIn,
}: {
  availableMinor?: string;
  signedIn: boolean;
}) {
  return (
    <div className="hidden min-h-11 items-center rounded-md border border-border px-3 sm:flex">
      <div>
        <p className="text-[10px] tracking-[0.14em] text-faint uppercase">Demo</p>
        <p className="text-sm font-medium tabular-nums">
          {signedIn && availableMinor ? formatFbu(availableMinor) : 'Sign in'}
        </p>
      </div>
    </div>
  );
}
