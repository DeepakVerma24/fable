export interface PlayerRecord {
  id: string;
  email: string;
  displayName: string;
  /** Output of a password hashing function. Never a raw password. */
  passwordHash: string;
  createdAt: string;
}

export interface PlayerSession {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAt: string;
}

export class PlayerStoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PlayerStoreError';
    this.code = code;
  }
}

export interface PlayerStore {
  findByEmail(email: string): Promise<PlayerRecord | null>;
  findById(id: string): Promise<PlayerRecord | null>;
  insert(player: PlayerRecord): Promise<void>;
  updateDisplayName(id: string, displayName: string): Promise<PlayerRecord>;
  saveSession(session: PlayerSession): Promise<void>;
  findSession(id: string): Promise<PlayerSession | null>;
  deleteSession(id: string): Promise<void>;
}

/**
 * Process-local player directory.
 * Used when DATABASE_URL is unset so local boot and CI do not need Postgres.
 * Password hashes are stored as opaque strings. This class does not hash them.
 */
export class InMemoryPlayerStore implements PlayerStore {
  private readonly byId = new Map<string, PlayerRecord>();
  private readonly byEmail = new Map<string, string>();
  private readonly sessions = new Map<string, PlayerSession>();

  async findByEmail(email: string): Promise<PlayerRecord | null> {
    const id = this.byEmail.get(email.toLowerCase());
    if (!id) return null;
    return this.findById(id);
  }

  async findById(id: string): Promise<PlayerRecord | null> {
    const found = this.byId.get(id);
    return found ? { ...found } : null;
  }

  async insert(player: PlayerRecord): Promise<void> {
    const email = player.email.toLowerCase();
    if (this.byEmail.has(email)) {
      throw new PlayerStoreError('email_taken', 'An account with that email already exists.');
    }
    if (player.passwordHash.length < 20) {
      throw new PlayerStoreError('hash_required', 'A password hash is required.');
    }
    const stored: PlayerRecord = { ...player, email };
    this.byId.set(player.id, stored);
    this.byEmail.set(email, player.id);
  }

  async updateDisplayName(id: string, displayName: string): Promise<PlayerRecord> {
    const found = this.byId.get(id);
    if (!found) {
      throw new PlayerStoreError('missing', 'Player was not found.');
    }
    const next = { ...found, displayName };
    this.byId.set(id, next);
    return { ...next };
  }

  async saveSession(session: PlayerSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async findSession(id: string): Promise<PlayerSession | null> {
    const found = this.sessions.get(id);
    if (!found) return null;
    if (Date.parse(found.expiresAt) <= Date.now()) {
      this.sessions.delete(id);
      return null;
    }
    return { ...found };
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }
}
