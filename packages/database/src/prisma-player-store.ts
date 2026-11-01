import type { PlayerRecord, PlayerSession, PlayerStore } from '@fable/domain';
import { PlayerStoreError } from '@fable/domain';

import type { PrismaClient } from './generated/prisma/client';

/**
 * Postgres player directory.
 * Sessions live in the sessions table. Journals stay in the ledger tables.
 * This store never writes a ledger line.
 */
export class PrismaPlayerStore implements PlayerStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<PlayerRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return row ? mapUser(row) : null;
  }

  async findById(id: string): Promise<PlayerRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }

  async insert(player: PlayerRecord): Promise<void> {
    try {
      await this.prisma.user.create({
        data: {
          id: player.id,
          email: player.email.toLowerCase(),
          displayName: player.displayName,
          passwordHash: player.passwordHash,
          createdAt: new Date(player.createdAt),
        },
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new PlayerStoreError('email_taken', 'An account with that email already exists.');
      }
      throw error;
    }
  }

  async updateDisplayName(id: string, displayName: string): Promise<PlayerRecord> {
    try {
      const row = await this.prisma.user.update({ where: { id }, data: { displayName } });
      return mapUser(row);
    } catch (error) {
      if (isMissing(error)) {
        throw new PlayerStoreError('missing', 'Player was not found.');
      }
      throw error;
    }
  }

  async saveSession(session: PlayerSession): Promise<void> {
    await this.prisma.session.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        userId: session.userId,
        csrfToken: session.csrfToken,
        expiresAt: new Date(session.expiresAt),
      },
      update: {
        csrfToken: session.csrfToken,
        expiresAt: new Date(session.expiresAt),
      },
    });
  }

  async findSession(id: string): Promise<PlayerSession | null> {
    const row = await this.prisma.session.findUnique({ where: { id } });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.delete({ where: { id } });
      return null;
    }
    return {
      id: row.id,
      userId: row.userId,
      csrfToken: row.csrfToken,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async deleteSession(id: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id } });
  }
}

function mapUser(row: {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: Date;
}): PlayerRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt.toISOString(),
  };
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}
