'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api-client';
import { useBetSlip } from '@/lib/bet-slip';
import { formatFbu, majorToMinor } from '@/lib/money';
import { estimatedPayoutMinor } from '@/lib/odds';
import type { DemoBet, SessionResponse } from '@/lib/types';

export function BetSlip({ signedIn }: { signedIn: boolean }) {
  const selection = useBetSlip((state) => state.selection);
  const stake = useBetSlip((state) => state.stake);
  const setStake = useBetSlip((state) => state.setStake);
  const remove = useBetSlip((state) => state.remove);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<DemoBet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const stakeMinor = majorToMinor(stake);
  const payout =
    selection && stakeMinor && !selection.suspended
      ? estimatedPayoutMinor(stakeMinor, selection.decimalOdds)
      : null;
  const stakeValid = stakeMinor !== null && stakeMinor >= 100n && stakeMinor <= 50_000n;

  const place = useMutation({
    mutationFn: async () => {
      if (!selection || !stakeMinor) throw new ApiError('Enter a stake.', 400);
      return api<DemoBet>('/demo/bets', {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey: createKey(),
          selectionId: selection.selectionId,
          stakeMinor: stakeMinor.toString(),
        }),
      });
    },
    onSuccess: async (bet) => {
      setResult(bet);
      setError(null);
      setConfirm(false);
      remove();
      await queryClient.invalidateQueries({ queryKey: ['wallet'] });
      await queryClient.invalidateQueries({ queryKey: ['bets'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (reason) => {
      setConfirm(false);
      setResult(null);
      setError(reason instanceof ApiError ? reason.message : 'The demo bet was not accepted.');
    },
  });

  if (!selection && !result) {
    return (
      <EmptyState
        title="Slip is empty"
        body="Choose one demo price. Prices are fixtures, not a live feed, and the stake is Fable demo units."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Demo slip</p>
      {selection ? (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{selection.selectionName}</p>
              <p className="text-xs text-muted-foreground">{selection.eventName}</p>
              <p className="text-xs text-faint">
                {selection.marketName} · {selection.decimalOdds}
              </p>
            </div>
            <button
              type="button"
              className="min-h-11 text-xs text-muted-foreground underline"
              onClick={remove}
            >
              Remove
            </button>
          </div>
          {selection.suspended ? (
            <p className="mt-2 text-xs text-warning">This demo market is suspended.</p>
          ) : null}
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="demo-stake">Stake (FBU)</Label>
            <Input
              id="demo-stake"
              inputMode="decimal"
              value={stake}
              onChange={(event) => {
                setStake(event.target.value);
                setError(null);
              }}
              aria-invalid={!stakeValid}
              className="h-11 tabular-nums"
            />
            <p className="text-xs text-faint">
              Between 1.00 and 500.00. Estimated return includes the stake.
            </p>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Estimated return</dt>
            <dd className="text-right font-medium tabular-nums">
              {payout ? formatFbu(payout) : '—'}
            </dd>
          </dl>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {result ? (
        <div role="status" className="rounded-lg border border-border bg-background p-3 text-sm">
          <p className="font-medium">{result.outcome === 'win' ? 'Demo win' : 'Demo loss'}</p>
          <p className="mt-1 text-muted-foreground">{result.note}</p>
          <p className="mt-2 tabular-nums">
            Stake {formatFbu(result.stakeMinor)} · Return {formatFbu(result.payoutMinor)}
          </p>
        </div>
      ) : null}
      {selection ? (
        <Button
          type="button"
          className="h-11 w-full"
          disabled={!signedIn || !stakeValid || selection.suspended || place.isPending}
          onClick={() => setConfirm(true)}
        >
          {!signedIn ? 'Sign in to submit' : place.isPending ? 'Submitting' : 'Submit demo bet'}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title="Submit this demo bet?"
        body={
          selection && stakeMinor
            ? `Reserve ${formatFbu(stakeMinor)} on ${selection.selectionName}. Settlement uses a fixed demo rule, not a sports result. Nothing here is real money.`
            : ''
        }
        confirmLabel="Submit"
        pending={place.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => place.mutate()}
      />
    </div>
  );
}

export function sessionSignedIn(session: SessionResponse | null | undefined): boolean {
  return Boolean(session?.player);
}

function createKey(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `slip-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
