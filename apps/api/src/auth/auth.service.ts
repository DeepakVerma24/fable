import { randomBytes, randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  DemoWallet,
  PlayerStoreError,
  type PlayerRecord,
  type PlayerSession,
  type PlayerStore,
} from '@fable/domain';

import { PLAYER_STORE } from '../player/tokens';
import { hashPassword, verifyPassword } from './password';

export interface PublicPlayer {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

const SESSION_MS = 12 * 60 * 60 * 1000;

export function toPublicPlayer(player: PlayerRecord): PublicPlayer {
  return {
    id: player.id,
    email: player.email,
    displayName: player.displayName,
    createdAt: player.createdAt,
  };
}

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    @Inject(PLAYER_STORE) private readonly players: PlayerStore,
    @Inject(DemoWallet) private readonly wallet: DemoWallet,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ player: PublicPlayer; session: PlayerSession }> {
    const player: PlayerRecord = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      displayName: input.displayName.trim(),
      passwordHash: await hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    try {
      await this.players.insert(player);
    } catch (error) {
      if (error instanceof PlayerStoreError && error.code === 'email_taken') {
        throw new ConflictException('An account with that email already exists.');
      }
      throw error;
    }
    await this.wallet.grant(player.id);
    return this.openSession(player);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ player: PublicPlayer; session: PlayerSession }> {
    const player = await this.players.findByEmail(email);
    const hash = player?.passwordHash ?? (await this.placeholderHash());
    const matches = await verifyPassword(password, hash);
    if (!player || !matches) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    await this.wallet.grant(player.id);
    return this.openSession(player);
  }

  async logout(sessionId: string): Promise<void> {
    await this.players.deleteSession(sessionId);
  }

  async rename(userId: string, displayName: string): Promise<PublicPlayer> {
    const player = await this.players.updateDisplayName(userId, displayName.trim());
    return toPublicPlayer(player);
  }

  private async openSession(
    player: PlayerRecord,
  ): Promise<{ player: PublicPlayer; session: PlayerSession }> {
    const session: PlayerSession = {
      id: randomBytes(32).toString('base64url'),
      userId: player.id,
      csrfToken: randomBytes(32).toString('base64url'),
      expiresAt: new Date(Date.now() + SESSION_MS).toISOString(),
    };
    await this.players.saveSession(session);
    return { player: toPublicPlayer(player), session };
  }

  private placeholderHash(): Promise<string> {
    this.dummyHash ??= hashPassword('not-a-player-password');
    return this.dummyHash;
  }
}
