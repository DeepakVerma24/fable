import { Injectable, NotFoundException } from '@nestjs/common';
import { gameById, type DemoGame } from '@fable/domain';

@Injectable()
export class FavoritesService {
  private readonly byUser = new Map<string, Set<string>>();

  list(userId: string): DemoGame[] {
    const ids = this.byUser.get(userId);
    if (!ids) return [];
    return [...ids].flatMap((id) => {
      const game = gameById(id);
      return game ? [game] : [];
    });
  }

  add(userId: string, gameId: string): DemoGame {
    const game = gameById(gameId);
    if (!game) throw new NotFoundException('That preview is not in the demo catalog.');
    const set = this.byUser.get(userId) ?? new Set<string>();
    set.add(gameId);
    this.byUser.set(userId, set);
    return game;
  }

  remove(userId: string, gameId: string): void {
    this.byUser.get(userId)?.delete(gameId);
  }
}
