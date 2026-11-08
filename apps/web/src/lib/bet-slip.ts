import { create } from 'zustand';
import { z } from 'zod';
import type { DemoBet } from './types';

export const SLIP_STORAGE_KEY = 'fable-sports-slip-v2';
export const PENDING_STORAGE_KEY = 'fable-sports-pending-v1';
const selectionSchema = z.object({
  selectionId: z.string().min(1).max(80),
  selectionName: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  marketName: z.string(),
  decimalOdds: z.string().regex(/^\d{1,3}\.\d{2}$/),
  suspended: z.boolean(),
});
export type SlipSelection = z.infer<typeof selectionSchema>;
const pendingSchema = z.object({
  key: z.string().regex(/^slip-[a-f0-9]{32}$/),
  playerId: z.string().min(1),
  selection: selectionSchema,
  stakeMinor: z.string().regex(/^[1-9]\d{0,8}$/),
  status: z.enum(['submitting', 'uncertain']),
  message: z.string(),
});
export type PendingBet = z.infer<typeof pendingSchema>;
const savedSchema = z.object({
  selections: z.array(selectionSchema).max(20),
  activeId: z.string().nullable(),
  stake: z.string().max(30),
  mode: z.enum(['single', 'accumulator']),
  pending: pendingSchema.nullable(),
});
type SavedSlip = z.infer<typeof savedSchema>;
interface BetSlipState extends SavedSlip {
  open: boolean;
  hydrated: boolean;
  busy: boolean;
  storageError: string | null;
  error: string | null;
  result: { playerId: string; bet: DemoBet } | null;
  hydrate: () => void;
  toggle: (selection: SlipSelection) => void;
  remove: (selectionId: string) => void;
  clear: () => void;
  activate: (selectionId: string) => void;
  acceptPrice: (selection: SlipSelection) => void;
  setStake: (stake: string) => void;
  setMode: (mode: SavedSlip['mode']) => void;
  setOpen: (open: boolean) => void;
}
const empty: SavedSlip = {
  selections: [],
  activeId: null,
  stake: '10.00',
  mode: 'single',
  pending: null,
};
function saved(state: SavedSlip): SavedSlip {
  return {
    selections: state.selections,
    activeId: state.activeId,
    stake: state.stake,
    mode: state.mode,
    pending: state.pending,
  };
}
export function readSavedSlip(): SavedSlip {
  const text = localStorage.getItem(SLIP_STORAGE_KEY);
  const draft = text ? savedSchema.parse(JSON.parse(text)) : { ...empty };
  const pending = localStorage.getItem(PENDING_STORAGE_KEY);
  return { ...draft, pending: pending ? pendingSchema.parse(JSON.parse(pending)) : draft.pending };
}
/** The request must be durably saved before a POST can leave this browser. */
export function saveSlip(update: Partial<BetSlipState>, required = false): void {
  const next = { ...useBetSlip.getState(), ...update };
  try {
    const changesPending = Object.hasOwn(update, 'pending');
    // Ordinary draft edits never write or delete the recovery record. Only the
    // submission coordinator, while holding the browser lock, changes it.
    if (!changesPending && localStorage.getItem(PENDING_STORAGE_KEY)) {
      useBetSlip.setState({ pending: readSavedSlip().pending });
      return;
    }
    localStorage.setItem(SLIP_STORAGE_KEY, JSON.stringify({ ...saved(next), pending: null }));
    if (changesPending) {
      if (next.pending) localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(next.pending));
      else localStorage.removeItem(PENDING_STORAGE_KEY);
    }
    useBetSlip.setState({ ...update, storageError: null });
  } catch {
    const message =
      'Browser storage is unavailable. Enable storage and reload before placing a bet; drafts cannot be saved safely.';
    useBetSlip.setState({ ...(required ? {} : update), storageError: message });
    if (required) throw new Error(message);
  }
}
const locked = () =>
  Boolean(
    useBetSlip.getState().pending ||
    useBetSlip.getState().busy ||
    useBetSlip.getState().storageError,
  );
export const useBetSlip = create<BetSlipState>((set, get) => ({
  ...empty,
  open: false,
  hydrated: false,
  busy: false,
  storageError: null,
  result: null,
  error: null,
  hydrate: () => {
    if (get().busy) return;
    try {
      const data = readSavedSlip();
      // A terminated page cannot know whether its last POST committed.
      if (data.pending)
        data.pending = {
          ...data.pending,
          status: 'uncertain',
          message:
            'Response uncertain. Retry the saved request to retrieve the result; do not place a replacement.',
        };
      set({ ...data, hydrated: true, error: null });
    } catch {
      // Never erase unreadable recovery data silently.
      set({
        hydrated: true,
        storageError:
          'Saved slip could not be read. Do not place a replacement for an unresolved bet. Restore browser storage before continuing.',
      });
    }
  },
  toggle: (selection) => {
    if (locked() || !get().hydrated) return;
    const exists = get().selections.some((item) => item.selectionId === selection.selectionId);
    if (exists) {
      get().remove(selection.selectionId);
      return;
    }
    if (get().selections.length >= 20) {
      set({ error: 'A draft can hold up to 20 selections.' });
      return;
    }
    const narrow =
      typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1279px)').matches;
    saveSlip({
      selections: [...get().selections, selection],
      activeId: selection.selectionId,
      open: Boolean(narrow),
      error: null,
      result: null,
    });
  },
  remove: (selectionId) => {
    if (locked()) return;
    const selections = get().selections.filter((item) => item.selectionId !== selectionId);
    saveSlip({
      selections,
      activeId:
        get().activeId === selectionId ? (selections[0]?.selectionId ?? null) : get().activeId,
      error: null,
    });
  },
  clear: () => {
    if (!locked()) saveSlip({ selections: [], activeId: null, error: null, result: null });
  },
  activate: (activeId) => {
    if (!locked()) saveSlip({ activeId, error: null });
  },
  acceptPrice: (selection) => {
    if (!locked())
      saveSlip({
        selections: get().selections.map((item) =>
          item.selectionId === selection.selectionId ? selection : item,
        ),
        error: null,
      });
  },
  setStake: (stake) => {
    if (!locked()) saveSlip({ stake: stake.slice(0, 30), error: null });
  },
  setMode: (mode) => {
    if (!locked()) saveSlip({ mode, error: null });
  },
  setOpen: (open) => set({ open }),
}));
