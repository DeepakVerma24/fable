import { PostgresOriginalSessions } from '@fable/database';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  OriginalError,
  ORIGINAL_GAMES,
  type OriginalAction,
  type StartOriginal,
} from '@fable/domain';
import { z } from 'zod';
import { AuthGuard, SessionCsrfGuard, type PlayerRequest } from '../auth/guards';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { assertWithinRate } from '../http/rate-limit';

export const ORIGINAL_ENGINE = Symbol('ORIGINAL_ENGINE');
export const originalEngineProvider = {
  provide: ORIGINAL_ENGINE,
  useFactory: () => new PostgresOriginalSessions(process.env.DATABASE_URL),
};
const key = z.string().regex(/^[a-zA-Z0-9._:-]{8,80}$/);
const startSchema = z
  .object({
    sessionId: z.string().uuid(),
    idempotencyKey: key,
    gameId: z.string().min(1).max(80),
    options: z
      .object({
        chance: z.number().int().optional(),
        mines: z.number().int().optional(),
        target: z.number().int().optional(),
      })
      .strict(),
  })
  .strict();
const actionSchema = z
  .object({
    sessionId: z.string().uuid(),
    idempotencyKey: key,
    expectedVersion: z.number().int().min(0).max(26),
    type: z.enum(['reveal', 'finish']),
    cell: z.number().int().min(0).max(24).optional(),
  })
  .strict();

@ApiTags('nonfinancial casino demos')
@Controller('casino/demo')
@UseGuards(AuthGuard)
export class OriginalsController {
  constructor(@Inject(ORIGINAL_ENGINE) private readonly engine: PostgresOriginalSessions) {}
  @Get('session')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Durable nonfinancial demo session.' })
  async session() {
    return {
      sessionId: await translate(() => this.engine.sessionId()),
      gameIds: ORIGINAL_GAMES.map((game) => game.id),
      simulated: true,
      financial: false,
      realMoney: false,
      persistence: 'postgresql',
      stateSchemaVersion: 1,
    };
  }
  @Get('rounds')
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() request: PlayerRequest, @Query('gameId') gameId?: string) {
    return {
      sessionId: await translate(() => this.engine.sessionId()),
      simulated: true,
      financial: false,
      items: await translate(() => this.engine.list(player(request), gameId)),
    };
  }
  @Get('rounds/:id')
  @Header('Cache-Control', 'private, no-store')
  get(@Req() request: PlayerRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return translate(() => this.engine.get(player(request), id));
  }
  @Post('rounds')
  @UseGuards(SessionCsrfGuard)
  @ApiOperation({
    summary:
      'Run an authenticated nonfinancial demo. Uses server crypto randomness; never touches a wallet.',
  })
  start(
    @Req() request: PlayerRequest,
    @Body(new ZodValidationPipe(startSchema)) input: StartOriginal,
  ) {
    assertWithinRate(`originals:${player(request)}`, 120, 60_000);
    return translate(() => this.engine.start(player(request), input));
  }
  @Post('rounds/:id/actions')
  @UseGuards(SessionCsrfGuard)
  act(
    @Req() request: PlayerRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(actionSchema)) input: OriginalAction,
  ) {
    assertWithinRate(`originals:${player(request)}`, 120, 60_000);
    return translate(() => this.engine.act(player(request), id, input));
  }
}
function player(request: PlayerRequest): string {
  if (!request.player) throw new Error('Auth guard did not attach a player.');
  return request.player.id;
}
async function translate<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof OriginalError)
      throw new HttpException(
        error.message,
        { invalid: 400, conflict: 409, not_found: 404, session_changed: 410, unavailable: 503 }[
          error.code
        ],
      );
    throw error;
  }
}
