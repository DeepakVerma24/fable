import { cn } from '@/lib/utils';

export function OddsButton({
  name,
  decimalOdds,
  selected,
  suspended,
  closed = false,
  onSelect,
}: {
  name: string;
  decimalOdds: string;
  selected: boolean;
  suspended: boolean;
  closed?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={suspended || closed}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-md border px-2 py-1 text-center transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        suspended && 'cursor-not-allowed border-border text-faint',
        !suspended && !selected && 'border-border bg-background hover:bg-accent',
        selected && 'border-primary bg-primary text-primary-foreground',
      )}
    >
      <span className="max-w-full truncate text-[11px] text-current/80">
        {name}
        {closed ? ' · Closed' : suspended ? ' · Suspended' : ''}
      </span>
      <span className="text-sm font-semibold tabular-nums">{decimalOdds}</span>
    </button>
  );
}
