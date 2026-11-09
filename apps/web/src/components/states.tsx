import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="section-heading">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-6">
      <Inbox className="size-4 text-faint" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function ErrorState({
  title = 'Something failed to load',
  body,
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-danger/40 bg-card px-4 py-5"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-danger">
        <AlertTriangle className="size-4" aria-hidden />
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-lg bg-surface-elevated" />
      ))}
    </div>
  );
}

export function InlinePending({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {label}
    </span>
  );
}
