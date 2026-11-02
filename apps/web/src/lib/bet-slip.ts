import { create } from 'zustand';

export interface SlipSelection {
  selectionId: string;
  selectionName: string;
  eventId: string;
  eventName: string;
  marketName: string;
  decimalOdds: string;
  suspended: boolean;
}

interface BetSlipState {
  selection: SlipSelection | null;
  pendingRequest: { fingerprint: string; key: string } | null;
  requestKey: (selectionId: string, stakeMinor: bigint) => string;
  stake: string;
  open: boolean;
  toggle: (selection: SlipSelection) => void;
  remove: () => void;
  setStake: (stake: string) => void;
  setOpen: (open: boolean) => void;
}

export const useBetSlip = create<BetSlipState>((set, get) => ({
  selection: null,
  pendingRequest: null,
  requestKey: (selectionId, stakeMinor) => {
    const fingerprint = JSON.stringify([selectionId, stakeMinor.toString()]);
    const pending = get().pendingRequest;
    if (pending?.fingerprint === fingerprint) return pending.key;
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const key = `slip-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    set({ pendingRequest: { fingerprint, key } });
    return key;
  },
  stake: '10.00',
  open: false,
  toggle: (selection) => {
    const current = get().selection;
    if (current?.selectionId === selection.selectionId) {
      set({ selection: null, pendingRequest: null });
      return;
    }
    const narrow =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 1279px)').matches;
    set({ selection, open: narrow, pendingRequest: null });
  },
  remove: () => set({ selection: null, pendingRequest: null }),
  setStake: (stake) => set({ stake }),
  setOpen: (open) => set({ open }),
}));
