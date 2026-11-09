import { api, ApiError } from './api-client';
import {
  readSavedSlip,
  saveSlip,
  useBetSlip,
  type PendingBet,
  type SlipSelection,
} from './bet-slip';
import { majorToMinor } from './money';
import { selectionAvailable } from './sports';
import type { DemoBet, DemoEvent, SessionResponse } from './types';

export function currentQuote(event: DemoEvent, draft: SlipSelection): SlipSelection | null {
  if (event.id !== draft.eventId) return null;
  for (const market of event.markets) {
    const selection = market.selections.find((item) => item.id === draft.selectionId);
    if (selection)
      return {
        ...draft,
        decimalOdds: selection.decimalOdds,
        suspended: !selectionAvailable(event, market, selection),
      };
  }
  return null;
}
const uncertain =
  'Response uncertain. Retry the saved request to retrieve the result; do not place a replacement.';
/** One POST at a time across mounted slips and tabs. No financial arithmetic is authoritative here. */
export async function submitSingle(playerId: string): Promise<DemoBet | null> {
  const initial = useBetSlip.getState();
  if (initial.busy) return null;
  if (!navigator.locks) {
    useBetSlip.setState({
      error:
        'This browser cannot safely coordinate submissions. Use a browser with Web Locks support.',
    });
    return null;
  }
  useBetSlip.setState({ busy: true, error: null });
  try {
    return await navigator.locks.request('fable-demo-bet-submit', async () => {
      let pending: PendingBet | null = useBetSlip.getState().pending;
      let sent = false;
      const recovering = Boolean(pending);
      let ownsRecovery = false;
      try {
        const disk = readSavedSlip();
        if (disk.pending?.key !== pending?.key)
          throw new Error(
            'Another tab changed the saved request. Reload to recover it before continuing.',
          );
        ownsRecovery = true;
        const state = useBetSlip.getState();
        if (
          !pending &&
          JSON.stringify([disk.selections, disk.activeId, disk.stake, disk.mode]) !==
            JSON.stringify([state.selections, state.activeId, state.stake, state.mode])
        )
          throw new Error('The draft changed in another tab. Reload before submitting.');
        if (!state.hydrated || state.storageError)
          throw new Error(state.storageError ?? 'Please wait for the saved slip.');
        if (pending && pending.playerId !== playerId)
          throw new Error(
            'Sign in to the account that submitted this saved request. It cannot be replayed as another player.',
          );
        const session = await api<SessionResponse>('/auth/me');
        if (session.player.id !== playerId)
          throw new Error('Your account changed. Reload before submitting.');
        if (!pending) {
          if (state.mode !== 'single')
            throw new Error('Accumulator placement is unavailable. Choose Single bet mode.');
          const selection = state.selections.find((item) => item.selectionId === state.activeId);
          const stakeMinor = majorToMinor(state.stake);
          if (!selection || !stakeMinor || stakeMinor < 100n || stakeMinor > 50_000n)
            throw new Error('Choose a selection and enter a stake between 1.00 and 500.00 FBU.');
          const event = await api<DemoEvent>(
            `/sports/events/${encodeURIComponent(selection.eventId)}`,
          );
          const quote = currentQuote(event, selection);
          if (!quote || quote.suspended)
            throw new Error('This selection is suspended, closed or no longer available.');
          if (quote.decimalOdds !== selection.decimalOdds)
            throw new Error(
              'Odds changed. Refresh the price and accept the new odds before submitting.',
            );
          pending = {
            key: `slip-${crypto.randomUUID().replaceAll('-', '')}`,
            playerId,
            selection,
            stakeMinor: stakeMinor.toString(),
            status: 'submitting',
            message: '',
          };
        } else pending = { ...pending, status: 'submitting' };
        saveSlip({ pending }, true);
        sent = true;
        const bet = await api<DemoBet>('/demo/bets', {
          method: 'POST',
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({
            idempotencyKey: pending.key,
            selectionId: pending.selection.selectionId,
            stakeMinor: pending.stakeMinor,
          }),
        });
        const remaining = useBetSlip
          .getState()
          .selections.filter((item) => item.selectionId !== pending?.selection.selectionId);
        saveSlip({
          pending: null,
          selections: remaining,
          activeId: remaining[0]?.selectionId ?? null,
          result: { playerId, bet },
          error: null,
        });
        return bet;
      } catch (error) {
        const definitive =
          error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.status);
        if (pending && ownsRecovery && ((sent && !definitive) || recovering)) {
          saveSlip({
            pending: { ...pending, status: 'uncertain', message: uncertain },
            error: null,
          });
        } else {
          if (sent) saveSlip({ pending: null });
          useBetSlip.setState({
            error: error instanceof Error ? error.message : 'The request failed before submission.',
          });
        }
        return null;
      }
    });
  } catch (error) {
    useBetSlip.setState({
      error:
        error instanceof Error ? error.message : 'The browser could not coordinate this request.',
    });
    return null;
  } finally {
    useBetSlip.setState({ busy: false });
  }
}
