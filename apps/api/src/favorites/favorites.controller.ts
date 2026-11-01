import { Controller, Delete, Get, Inject, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthGuard, SessionCsrfGuard, type PlayerRequest } from '../auth/guards';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@Controller('favorites')
@UseGuards(AuthGuard)
export class FavoritesController {
  constructor(@Inject(FavoritesService) private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Previews this player marked. Process-local.' })
  list(@Req() request: PlayerRequest) {
    return {
      simulated: true as const,
      demo: true as const,
      items: this.favorites.list(requiredPlayer(request)),
    };
  }

  @Put(':gameId')
  @UseGuards(SessionCsrfGuard)
  @ApiOperation({ summary: 'Save a preview. It does not launch a game.' })
  add(@Req() request: PlayerRequest, @Param('gameId') gameId: string) {
    return { item: this.favorites.add(requiredPlayer(request), gameId), simulated: true as const };
  }

  @Delete(':gameId')
  @UseGuards(SessionCsrfGuard)
  @ApiOperation({ summary: 'Remove a saved preview.' })
  remove(@Req() request: PlayerRequest, @Param('gameId') gameId: string) {
    this.favorites.remove(requiredPlayer(request), gameId);
    return { ok: true as const, simulated: true as const };
  }
}

function requiredPlayer(request: PlayerRequest): string {
  if (!request.player) throw new Error('Auth guard did not attach a player.');
  return request.player.id;
}
