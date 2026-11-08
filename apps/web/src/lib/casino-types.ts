export type OriginalKind = 'dice' | 'mines' | 'plinko' | 'limbo';
export interface OriginalOptions {
  chance?: number;
  mines?: number;
  target?: number;
}
export interface OriginalRound {
  id: string;
  gameId: string;
  kind: OriginalKind;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  stateSchemaVersion: 1;
  status: 'active' | 'complete';
  version: number;
  outcome: 'in-progress' | 'hit' | 'miss' | 'mine' | 'finished' | 'complete';
  simulated: true;
  financial: false;
  realMoney: false;
  referencePoints: 100;
  multiplierBps: number;
  returnPoints: number;
  dice?: { rollHundredths: number; chance: number };
  mines?: { mineCount: number; revealed: number[]; locations?: number[] };
  plinko?: { path: number[]; bucket: number };
  limbo?: { reachedHundredths: number; target: number };
}
export interface StartOriginal {
  sessionId: string;
  idempotencyKey: string;
  gameId: string;
  options: OriginalOptions;
}
export interface OriginalAction {
  sessionId: string;
  idempotencyKey: string;
  expectedVersion: number;
  type: 'reveal' | 'finish';
  cell?: number;
}

export interface OriginalSession {
  sessionId: string;
  gameIds: string[];
  simulated: true;
  financial: false;
  realMoney: false;
  persistence: 'postgresql';
  stateSchemaVersion: 1;
}
