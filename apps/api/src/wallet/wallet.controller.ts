import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { AuthGuard, type PlayerRequest } from '../auth/guards';
import { paginate } from '../http/page';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { WalletService } from './wallet.service';

const pageSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(50).optional(),
});

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(@Inject(WalletService) private readonly wallet: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Derived demo balances. Nothing here is withdrawable.' })
  summary(@Req() request: PlayerRequest) {
    return this.wallet.summary(requiredPlayer(request));
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Journals that touch this player. Posted and immutable.' })
  async transactions(
    @Req() request: PlayerRequest,
    @Query(new ZodValidationPipe(pageSchema)) query: z.infer<typeof pageSchema>,
  ) {
    const rows = await this.wallet.transactions(requiredPlayer(request));
    return paginate(rows, query);
  }
}

function requiredPlayer(request: PlayerRequest): string {
  if (!request.player) throw new Error('Auth guard did not attach a player.');
  return request.player.id;
}
