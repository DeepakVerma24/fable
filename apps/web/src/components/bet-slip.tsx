'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';
import { useBetSlip } from '@/lib/bet-slip';
import { currentQuote, submitSingle } from '@/lib/bet-placement';
import { formatFbu, majorToMinor } from '@/lib/money';
import { estimatedPayoutMinor } from '@/lib/odds';
import type { DemoEvent, SessionResponse } from '@/lib/types';

export function BetSlip({ signedIn, playerId }: { signedIn: boolean; playerId?: string }) {
  const id = useId();
  const state = useBetSlip();
  const [confirm, setConfirm] = useState(false);
  const queryClient = useQueryClient();
  const selection = state.selections.find((item) => item.selectionId === state.activeId);
  const quoteQuery = useQuery({
    queryKey: ['slip-quote', selection?.eventId],
    queryFn: () => api<DemoEvent>(`/sports/events/${encodeURIComponent(selection!.eventId)}`),
    enabled: Boolean(selection && !state.pending),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const quote = selection && quoteQuery.data ? currentQuote(quoteQuery.data, selection) : null;
  const changed = quote && selection && quote.decimalOdds !== selection.decimalOdds;
  const available = Boolean(
    quote && !quote.suspended && !quoteQuery.isError && !quoteQuery.isFetching,
  );
  const locked = state.busy || Boolean(state.pending);
  const stakeMinor = majorToMinor(state.stake);
  const stakeValid = stakeMinor !== null && stakeMinor >= 100n && stakeMinor <= 50_000n;
  const payout =
    selection && stakeMinor && available
      ? estimatedPayoutMinor(stakeMinor, selection.decimalOdds)
      : null;
  const result = state.result && state.result.playerId === playerId ? state.result.bet : null;
  async function place() {
    if (!playerId) return;
    const bet = await submitSingle(playerId);
    setConfirm(false);
    if (bet)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wallet'] }),
        queryClient.invalidateQueries({ queryKey: ['bets'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
    else void quoteQuery.refetch();
  }
  if (!state.hydrated)
    return (
      <p role="status" className="text-sm">
        Restoring saved slip…
      </p>
    );
  return (
    <div className="space-y-3">
      <p className="text-xs text-faint">
        {state.selections.length} draft selections · Fable demo units
      </p>
      {state.storageError ? (
        <p role="alert" className="text-sm text-danger">
          {state.storageError}
        </p>
      ) : null}
      {!state.selections.length && !state.pending ? (
        <EmptyState
          title="Slip is empty"
          body="Choose demo prices to save a draft. Place one simulated single at a time. Prices are not a live feed."
        />
      ) : (
        <>
          <div role="group" aria-label="Bet type" className="flex flex-wrap gap-2">
            <button
              className="sports-filter"
              disabled={locked}
              aria-pressed={state.mode === 'single'}
              onClick={() => state.setMode('single')}
            >
              Single bet
            </button>
            <button
              className="sports-filter"
              disabled={locked}
              aria-pressed={state.mode === 'accumulator'}
              onClick={() => state.setMode('accumulator')}
            >
              Accumulator
            </button>
          </div>
          {state.mode === 'accumulator' ? (
            <p role="status" className="text-sm text-muted-foreground">
              Accumulator preview only. Combined pricing, reservation and settlement are
              unsupported. Placement is disabled.
            </p>
          ) : (
            <p className="text-xs text-faint">
              Choose one draft below to place. Other selections remain drafts; they are not
              submitted together.
            </p>
          )}
          <ul className="space-y-2" aria-label="Draft selections">
            {state.selections.map((item) => (
              <li
                key={item.selectionId}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex min-h-11 min-w-0 items-start gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name={`${id}-active`}
                      className="mt-1 size-4 shrink-0 accent-primary"
                      checked={item.selectionId === state.activeId}
                      disabled={locked || state.mode !== 'single'}
                      onChange={() => state.activate(item.selectionId)}
                    />
                    <span className="min-w-0 break-words">
                      {item.selectionName}
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {item.eventName}
                      </span>
                      <span className="block text-xs font-normal text-faint">
                        {item.marketName} · {item.decimalOdds}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={locked}
                    className="min-h-11 shrink-0 text-xs underline disabled:opacity-50"
                    onClick={() => state.remove(item.selectionId)}
                  >
                    Remove
                    <span className="sr-only">
                      {' '}
                      {state.selections.length > 1 ? item.selectionName : ''}
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="min-h-11 text-xs underline disabled:opacity-50"
            disabled={locked}
            onClick={state.clear}
          >
            Clear all selections
          </button>
          {selection ? (
            <div className="space-y-2">
              <Label htmlFor={`${id}-stake`}>Stake (FBU)</Label>
              <Input
                id={`${id}-stake`}
                inputMode="decimal"
                value={state.stake}
                disabled={locked || state.mode !== 'single'}
                onChange={(e) => state.setStake(e.target.value)}
                aria-invalid={!stakeValid}
                aria-describedby={`${id}-limits`}
                className="h-11"
              />
              <p id={`${id}-limits`} className="text-xs text-faint">
                Between 1.00 and 500.00. Estimated return includes the stake.
              </p>
              {state.mode === 'single' ? (
                <dl className="flex justify-between gap-2 text-sm">
                  <dt>Estimated return</dt>
                  <dd>{payout ? formatFbu(payout) : '—'}</dd>
                </dl>
              ) : null}
              {!state.pending ? (
                <>
                  {quoteQuery.isFetching ? (
                    <p role="status" className="text-xs">
                      Checking current availability…
                    </p>
                  ) : null}
                  {quoteQuery.isError ? (
                    <div role="alert" className="text-xs text-danger">
                      Availability check failed.{' '}
                      <button
                        className="min-h-11 underline"
                        onClick={() => void quoteQuery.refetch()}
                      >
                        Refresh availability
                      </button>
                    </div>
                  ) : null}
                  {!quoteQuery.isFetching && !quoteQuery.isError && !available ? (
                    <p role="alert" className="text-sm text-warning">
                      Selection suspended, closed or unavailable. Placement is disabled.
                    </p>
                  ) : null}
                  {changed && quote ? (
                    <div role="alert" className="text-sm">
                      <p>
                        Odds changed: {selection.decimalOdds} → {quote.decimalOdds}
                      </p>
                      <button className="sports-filter" onClick={() => state.acceptPrice(quote)}>
                        Accept new odds {quote.decimalOdds}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          {state.pending ? (
            <div role="status" className="rounded-md border border-border bg-accent p-3 text-sm">
              <p>{state.busy ? 'Submitting saved single…' : state.pending.message}</p>
              <p className="mt-2">
                Saved stake {formatFbu(state.pending.stakeMinor)} on{' '}
                {state.pending.selection.selectionName}. Draft editing is locked until resolved.
              </p>
              {state.pending.playerId !== playerId ? (
                <p className="mt-2">Sign in to the original account to recover this request.</p>
              ) : null}
              <Button
                className="mt-3 min-h-11 w-full"
                disabled={
                  state.busy || state.pending.playerId !== playerId || Boolean(state.storageError)
                }
                onClick={() => void place()}
              >
                Retry saved request
              </Button>
            </div>
          ) : (
            <Button
              className="h-11 w-full"
              disabled={
                !signedIn ||
                !playerId ||
                !stakeValid ||
                !available ||
                Boolean(changed) ||
                state.busy ||
                Boolean(state.storageError) ||
                state.mode !== 'single'
              }
              onClick={() => setConfirm(true)}
            >
              {state.mode === 'accumulator'
                ? 'Accumulator unavailable'
                : !signedIn
                  ? 'Sign in to submit'
                  : state.busy
                    ? 'Submitting'
                    : 'Submit demo bet'}
            </Button>
          )}
        </>
      )}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {result ? (
        <div role="status" className="rounded-lg border border-border bg-background p-3 text-sm">
          <p className="font-medium">{result.outcome === 'win' ? 'Demo win' : 'Demo loss'}</p>
          <p className="mt-1 text-muted-foreground">{result.note}</p>
          <p className="mt-2">
            Stake {formatFbu(result.stakeMinor)} · Return {formatFbu(result.payoutMinor)}
          </p>
          <Link
            href={`/bets/${encodeURIComponent(result.id)}`}
            className="inline-flex min-h-11 items-center underline"
          >
            View bet details
          </Link>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title="Submit this demo bet?"
        body={
          selection && stakeMinor
            ? `Reserve ${formatFbu(stakeMinor)} on ${selection.selectionName} at demo odds ${selection.decimalOdds}. Only this single is submitted. Settlement uses a fixed demo rule, not a sports result. Nothing here is real money.`
            : ''
        }
        confirmLabel="Submit"
        pending={state.busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void place()}
      />
    </div>
  );
}
export function sessionSignedIn(session: SessionResponse | null | undefined): boolean {
  return Boolean(session?.player);
}
