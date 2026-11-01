import { create } from 'zustand';

interface OperatorNoteState {
  note: string;
  setNote: (note: string) => void;
  clear: () => void;
}

/** Session-only note. Not a balance, not persisted to the ledger. */
export const useOperatorNote = create<OperatorNoteState>()((set) => ({
  note: '',
  setNote: (note) => set({ note }),
  clear: () => set({ note: '' }),
}));
