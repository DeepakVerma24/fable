import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { AuthGuard, SessionCsrfGuard, type PlayerRequest } from '../auth/guards';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { BetService } from './bet.service';

const placeSchema = z.object({
  idempotencyKey: z
    .string()
    .regex(/^[a-z0-9._:-]{8,80}$/, 'Idempotency key must be 8 to 80 safe characters.'),
  selectionId: z.string().trim().min(1).max(80),
  stakeMinor: z.string().regex(/^[1-9]\d{0,8}$/, 'Stake must be a positive number of minor units.'),
});

@ApiTags('sports')
@Controller('demo/bets')
@UseGuards(AuthGuard)
export class BetController {
  constructor(@Inject(BetService) private readonly bets: BetService) {}

  @Get()
  @ApiOperation({ summary: 'Demo bets placed in this API process.' })
  async list(@Req() request: PlayerRequest) {
    return {
      simulated: true as const,
      realMoney: false as const,
      items: await this.bets.list(requiredPlayer(request)),
    };
  }

  @Post()
  @UseGuards(SessionCsrfGuard)
  @ApiOperation({
    summary:
      'Reserve a demo stake and settle it with the fixed demo rule. Odds come from the board.',
  })
  place(
    @Req() request: PlayerRequest,
    @Body(new ZodValidationPipe(placeSchema)) body: z.infer<typeof placeSchema>,
  ) {
    return this.bets.place(requiredPlayer(request), {
      idempotencyKey: body.idempotencyKey,
      selectionId: body.selectionId,
      stakeMinor: BigInt(body.stakeMinor),
    });
  }
}

function requiredPlayer(request: PlayerRequest): string {
  if (!request.player) throw new Error('Auth guard did not attach a player.');
  return request.player.id;
}
