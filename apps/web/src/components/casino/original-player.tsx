'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api-client';
import {
  casinoRequest,
  commandKey,
  readCasinoCommand,
  saveCasinoCommand,
  type CasinoCommand,
} from '@/lib/casino-session';
import { rememberPlayed } from '@/lib/played';
import type { OriginalOptions, OriginalRound, OriginalSession } from '@/lib/casino-types';
import type { SessionResponse } from '@/lib/types';
import { ErrorState, LoadingSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';

export function OriginalPlayer({ gameId, playerId }: { gameId: string; playerId: string }) {
  const session = useQuery({
    queryKey: ['original-session', playerId],
    queryFn: () => api<OriginalSession>('/casino/demo/session'),
    refetchOnWindowFocus: true,
  });
  const rounds = useQuery({
    queryKey: ['original-rounds', playerId, gameId],
    queryFn: () =>
      api<{ items: OriginalRound[] }>(`/casino/demo/rounds?gameId=${encodeURIComponent(gameId)}`),
    refetchOnWindowFocus: true,
  });
  const [selected, setSelected] = useState<OriginalRound | null>(null);
  const [pending, setPending] = useState<CasinoCommand | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [storageBroken, setStorageBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [chance, setChance] = useState('50');
  const [mines, setMines] = useState('3');
  const [target, setTarget] = useState('2');
  const revisionKey = `fable.original.revision.${playerId}.${gameId}`;
  const current =
    rounds.data?.items[0] ?? (selected?.sessionId === session.data?.sessionId ? selected : null);
  const refetchHistory = rounds.refetch;
  useEffect(() => {
    const sync = (event?: StorageEvent) => {
      if (event?.key === revisionKey) void refetchHistory();
      if (event?.key && event.key !== commandKey(playerId, gameId)) return;
      if (busyRef.current) return;
      try {
        setPending(readCasinoCommand(playerId, gameId));
      } catch {
        setStorageBroken(true);
        setError(
          'Saved demo request could not be read. Clear local recovery to continue; no wallet funds are involved.',
        );
      }
      setReady(true);
    };
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [playerId, gameId, revisionKey, refetchHistory]);
  async function refresh() {
    await Promise.all([session.refetch(), rounds.refetch()]);
  }
  async function execute(command: CasinoCommand, retry = false) {
    if (busyRef.current) return;
    if (!navigator.locks) {
      setError(
        'This browser cannot safely coordinate demo actions. Use a browser with Web Locks support.',
      );
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNeedsSignIn(false);
    let sent = false;
    try {
      const revision = localStorage.getItem(revisionKey);
      await navigator.locks.request(`fable-original:${playerId}:${gameId}`, async () => {
        const saved = readCasinoCommand(playerId, gameId);
        if (retry && !saved) {
          // Another tab resolved the pending command while this one waited for the lock.
          setPending(null);
          await rounds.refetch();
          return;
        }
        if (saved && saved.idempotencyKey !== command.idempotencyKey) {
          setPending(saved);
          throw new Error(
            'Another tab has a pending demo action. Retry that saved action before starting a new one.',
          );
        }
        if (!retry && localStorage.getItem(revisionKey) !== revision)
          throw new Error('Another tab completed a round. Refresh before starting another.');
        const me = await api<SessionResponse>('/auth/me');
        if (me.player.id !== playerId)
          throw new Error('Your account changed. Reload before acting.');
        saveCasinoCommand(command);
        setPending(command);
        const request = casinoRequest(command);
        sent = true;
        const result = await api<OriginalRound>(request.path, {
          method: 'POST',
          body: JSON.stringify(request.body),
          signal: AbortSignal.timeout(15_000),
        });
        // Write the revision first: a crash before clearing still safely replays this action.
        localStorage.setItem(revisionKey, command.idempotencyKey);
        localStorage.removeItem(commandKey(playerId, gameId));
        setPending(null);
        setSelected(result);
        rememberPlayed(playerId, gameId);
        await rounds.refetch();
      });
    } catch (reason) {
      const authExpired = reason instanceof ApiError && [401, 403].includes(reason.status);
      const definitive = reason instanceof ApiError && [400, 404, 409, 410].includes(reason.status);
      if (authExpired) {
        // An earlier attempt may have completed before its response was lost.
        // Keep its key through reauthentication so it can be replayed safely.
        setNeedsSignIn(true);
        setError(
          'Sign in again, then retry the saved demo action. Your recovery request is retained.',
        );
        await refresh();
      } else if (definitive) {
        try {
          const saved = readCasinoCommand(playerId, gameId);
          if (saved?.idempotencyKey === command.idempotencyKey)
            localStorage.removeItem(commandKey(playerId, gameId));
          setPending(null);
        } catch {
          setStorageBroken(true);
        }
        setError(reason.message);
        await refresh();
      } else if (sent)
        setError(
          'Response uncertain. Retry the saved demo action to retrieve its result. No wallet transaction is involved.',
        );
      else setError(reason instanceof Error ? reason.message : 'The action could not start.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function startRound() {
    if (!session.data || pending || busyRef.current || storageBroken) return;
    const options: OriginalOptions =
      gameId === 'paper-dice'
        ? { chance: Number(chance) }
        : gameId === 'fable-mines'
          ? { mines: Number(mines) }
          : gameId === 'fable-limbo'
            ? { target: Number(target) }
            : {};
    void execute({
      kind: 'start',
      playerId,
      gameId,
      sessionId: session.data.sessionId,
      idempotencyKey: crypto.randomUUID(),
      options,
    });
  }
  function act(type: 'reveal' | 'finish', cell?: number) {
    if (!current || pending || busyRef.current || storageBroken) return;
    void execute({
      kind: 'action',
      playerId,
      gameId,
      sessionId: current.sessionId,
      roundId: current.id,
      idempotencyKey: crypto.randomUUID(),
      expectedVersion: current.version,
      type,
      ...(cell === undefined ? {} : { cell }),
    });
  }
  if (!ready || session.isLoading || rounds.isLoading) return <LoadingSkeleton />;
  // A full navigation renews the anonymous CSRF form when both session cookies expired.
  const signIn = (
    <a
      className="inline-flex min-h-11 items-center underline"
      href={`/login?next=${encodeURIComponent(`/casino/game/${gameId}?play=1`)}`}
    >
      Sign in again
    </a>
  );
  if (session.isError || rounds.isError || !session.data)
    return (
      <div className="space-y-3">
        <ErrorState
          title="Demo unavailable"
          body="The server demo session could not be loaded. Sign in if your session expired, then retry."
          onRetry={() => void refresh()}
        />
        {signIn}
      </div>
    );
  if (!session.data.gameIds.includes(gameId))
    return (
      <ErrorState title="Demo unavailable" body="This API instance does not support this game." />
    );
  const active = current?.status === 'active';
  const disabled = busy || Boolean(pending) || storageBroken;
  const valid =
    gameId === 'paper-dice'
      ? validInteger(chance, 5, 95)
      : gameId === 'fable-mines'
        ? validInteger(mines, 1, 10)
        : gameId === 'fable-limbo'
          ? validInteger(target, 2, 100)
          : true;
  return (
    <section
      aria-label="Nonfinancial game"
      className="original-player space-y-4 rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-[Georgia]">Practice room</h2>
        <span className="rounded-full bg-accent px-3 py-1 text-xs">
          Server-generated · no money
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Every round uses a fixed reference of 100 practice points. These are calculations, not a
        balance. Nothing is charged, credited or settled in your wallet.
      </p>
      <div className="sports-filters">
        {gameId === 'paper-dice' ? (
          <label>
            Win chance (%)
            <input
              aria-label="Win chance (%)"
              type="number"
              min={5}
              max={95}
              step={1}
              value={chance}
              disabled={disabled}
              onChange={(e) => setChance(e.target.value)}
            />
          </label>
        ) : null}
        {gameId === 'fable-mines' ? (
          <label>
            Number of mines
            <select
              aria-label="Number of mines"
              value={active ? current.mines?.mineCount : mines}
              disabled={disabled || active}
              onChange={(e) => setMines(e.target.value)}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {gameId === 'fable-limbo' ? (
          <label>
            Target multiplier
            <input
              aria-label="Target multiplier"
              type="number"
              min={2}
              max={100}
              step={1}
              value={target}
              disabled={disabled}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
        ) : null}
      </div>
      {!valid ? (
        <p role="alert" className="text-sm text-danger">
          Enter a whole number within the shown limits.
        </p>
      ) : null}
      {current ? (
        <div className="game-result" aria-live="polite">
          <p className="text-xs tracking-widest text-faint uppercase">
            {active ? 'Round in progress' : 'Recorded demo result'}
          </p>
          {current.dice ? (
            <p className="original-number">
              {(current.dice.rollHundredths / 100).toFixed(2)}
              <span className="block text-sm font-normal">
                {current.outcome === 'hit' ? 'Below' : 'At or above'} {current.dice.chance}.00 ·{' '}
                {current.outcome}
              </span>
            </p>
          ) : null}
          {current.limbo ? (
            <p className="original-number">
              {(current.limbo.reachedHundredths / 100).toFixed(2)}×
              <span className="block text-sm font-normal">
                Target {current.limbo.target}× · {current.outcome}
              </span>
            </p>
          ) : null}
          {current.plinko ? (
            <PlinkoBoard path={current.plinko.path} bucket={current.plinko.bucket} />
          ) : null}
          {current.mines ? (
            <div className="space-y-3">
              <p className="text-sm">
                {current.mines.mineCount} {current.mines.mineCount === 1 ? 'mine' : 'mines'} ·{' '}
                {current.mines.revealed.length}{' '}
                {current.mines.revealed.length === 1 ? 'cell' : 'cells'} revealed
                {active ? '' : current.outcome === 'mine' ? ' · Mine revealed' : ' · Finished'}
              </p>
              <div role="group" aria-label="Mines board" className="mines-grid">
                {Array.from({ length: 25 }, (_, cell) => {
                  const revealed = current.mines!.revealed.includes(cell);
                  const mine = current.mines!.locations?.includes(cell);
                  return (
                    <button
                      key={cell}
                      type="button"
                      className={`mine-cell ${revealed ? 'revealed' : ''} ${mine ? 'mine-found' : ''}`}
                      disabled={disabled || revealed || !active}
                      aria-label={`Cell ${cell + 1}${mine ? ', mine' : revealed ? ', safe' : ''}`}
                      onClick={() => act('reveal', cell)}
                    >
                      {mine ? '×' : revealed ? '◇' : cell + 1}
                    </button>
                  );
                })}
              </div>
              {active ? (
                <Button
                  className="min-h-11"
                  disabled={disabled || !current.mines.revealed.length}
                  onClick={() => act('finish')}
                >
                  Finish demo round
                </Button>
              ) : null}
            </div>
          ) : null}
          <p className="mt-4 text-sm font-medium">
            {active && current.mines?.revealed.length === 0 ? (
              'Reveal a safe cell to unlock Finish.'
            ) : (
              <>
                {active ? 'If finished now' : 'Illustrative return'}:{' '}
                {current.returnPoints.toLocaleString()} practice points ·{' '}
                {(current.multiplierBps / 10000).toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}
                ×
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-faint">Not a settled wallet transaction.</p>
        </div>
      ) : (
        <div className="game-result text-center">
          <p className="text-2xl font-[Georgia]">Ready when you are.</p>
          <p className="mt-2 text-sm text-faint">
            Choose your settings and start a server-driven practice round.
          </p>
        </div>
      )}
      {needsSignIn ? signIn : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {pending ? (
        <div role="status" className="rounded-lg bg-accent p-3 text-sm">
          <p>
            {busy
              ? 'Waiting for the server…'
              : 'A saved demo action needs a confirmed response. Retry uses the same action key.'}
          </p>
          <Button
            className="mt-3 min-h-11"
            disabled={busy || storageBroken}
            onClick={() => void execute(pending, true)}
          >
            Retry saved demo action
          </Button>
        </div>
      ) : null}
      {storageBroken ? (
        <Button
          variant="outline"
          onClick={() => {
            try {
              localStorage.removeItem(commandKey(playerId, gameId));
              setPending(null);
              setStorageBroken(false);
              setError(null);
              void refresh();
            } catch {
              setError('Browser storage remains unavailable.');
            }
          }}
        >
          Clear local demo recovery
        </Button>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11" disabled={disabled || active || !valid} onClick={startRound}>
          {busy ? 'Working…' : current ? 'Start another demo round' : 'Start demo round'}
        </Button>
        <Button
          className="min-h-11"
          variant="outline"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Refresh round
        </Button>
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
          Saved practice rounds
        </summary>
        <ul className="space-y-2">
          {rounds.data?.items.map((round) => (
            <li key={round.id} className="text-xs text-muted-foreground">
              {new Date(round.createdAt).toLocaleString()} · {round.status} · {round.outcome} ·{' '}
              {round.returnPoints} practice points
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint">
          Your latest 50 practice rounds are saved to your account. Active Mines rounds appear
          first.
        </p>
      </details>
    </section>
  );
}
function validInteger(text: string, min: number, max: number) {
  return /^\d+$/.test(text) && Number(text) >= min && Number(text) <= max;
}
function PlinkoBoard({ path, bucket }: { path: number[]; bucket: number }) {
  return (
    <div className="plinko-board">
      <div
        role="img"
        aria-label={`Eight-step Plinko path ${path.map((step) => (step ? 'right' : 'left')).join(', ')}. Bucket ${bucket + 1}.`}
      >
        {path.map((_, row) => {
          const selected = path.slice(0, row + 1).reduce((sum, step) => sum + step, 0);
          return (
            <div className="plinko-row" key={row}>
              {Array.from({ length: row + 2 }, (_, i) => (
                <span key={i} className={i === selected ? 'plinko-hit' : ''}>
                  •
                </span>
              ))}
            </div>
          );
        })}
        <div className="plinko-buckets">
          {['5', '2', '1', '.5', '.2', '.5', '1', '2', '5'].map((value, i) => (
            <span key={i} className={i === bucket ? 'plinko-hit' : ''}>
              {value}×
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs">Bucket {bucket + 1} · the path is generated on the server.</p>
    </div>
  );
}
