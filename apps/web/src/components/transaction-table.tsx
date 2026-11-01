import { formatFbu } from '@/lib/money';
import type { WalletTransaction } from '@/lib/types';

export function TransactionTable({ rows }: { rows: WalletTransaction[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">Demo wallet transactions</caption>
        <thead className="bg-card text-xs tracking-wide text-faint uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium">Reference</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                <time dateTime={row.postedAt}>{formatWhen(row.postedAt)}</time>
              </td>
              <td className="px-3 py-2">{row.description}</td>
              <td className="px-3 py-2 font-mono text-xs text-faint">{row.reference}</td>
              <td className="px-3 py-2">Posted</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatFbu(row.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
