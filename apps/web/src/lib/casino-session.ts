import { z } from 'zod';
import type { OriginalAction, StartOriginal } from './casino-types';
const common = {
  playerId: z.string().min(1),
  gameId: z.string().min(1).max(80),
  sessionId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
};
const start = z.object({
  ...common,
  kind: z.literal('start'),
  options: z
    .object({
      chance: z.number().int().optional(),
      mines: z.number().int().optional(),
      target: z.number().int().optional(),
    })
    .strict(),
});
const action = z.object({
  ...common,
  kind: z.literal('action'),
  roundId: z.string().uuid(),
  expectedVersion: z.number().int().min(0).max(26),
  type: z.enum(['reveal', 'finish']),
  cell: z.number().int().min(0).max(24).optional(),
});
const schema = z.discriminatedUnion('kind', [start, action]);
export type CasinoCommand = z.infer<typeof schema>;
export const commandKey = (playerId: string, gameId: string) =>
  `fable.original.pending.${playerId}.${gameId}`;
export function readCasinoCommand(playerId: string, gameId: string): CasinoCommand | null {
  const raw = localStorage.getItem(commandKey(playerId, gameId));
  if (!raw) return null;
  const parsed = schema.parse(JSON.parse(raw));
  if (parsed.playerId !== playerId || parsed.gameId !== gameId)
    throw new Error('Saved demo request belongs to another account or game.');
  return parsed;
}
export function saveCasinoCommand(command: CasinoCommand): void {
  localStorage.setItem(
    commandKey(command.playerId, command.gameId),
    JSON.stringify(schema.parse(command)),
  );
}
export function casinoRequest(command: CasinoCommand): {
  path: string;
  body: StartOriginal | OriginalAction;
} {
  return command.kind === 'start'
    ? {
        path: '/casino/demo/rounds',
        body: {
          sessionId: command.sessionId,
          idempotencyKey: command.idempotencyKey,
          gameId: command.gameId,
          options: command.options,
        },
      }
    : {
        path: `/casino/demo/rounds/${encodeURIComponent(command.roundId)}/actions`,
        body: {
          sessionId: command.sessionId,
          idempotencyKey: command.idempotencyKey,
          expectedVersion: command.expectedVersion,
          type: command.type,
          ...(command.cell === undefined ? {} : { cell: command.cell }),
        },
      };
}
