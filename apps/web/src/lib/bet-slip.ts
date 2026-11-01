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
  stake: string;
  open: boolean;
  toggle: (selection: SlipSelection) => void;
  remove: () => void;
  setStake: (stake: string) => void;
  setOpen: (open: boolean) => void;
}

export const useBetSlip = create<BetSlipState>((set, get) => ({
  selection: null,
  stake: '10.00',
  open: false,
  toggle: (selection) => {
    const current = get().selection;
    if (current?.selectionId === selection.selectionId) {
      set({ selection: null });
      return;
    }
    const narrow =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 1279px)').matches;
    set({ selection, open: narrow });
  },
  remove: () => set({ selection: null }),
  setStake: (stake) => set({ stake }),
  setOpen: (open) => set({ open }),
}));
