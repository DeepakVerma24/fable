export interface UserRecord {
  id: string;
  email: string;
}

export interface IdentityDirectory {
  findByEmail(email: string): Promise<UserRecord | null>;
}

/** In-memory directory used until a real identity provider is introduced. */
export class InMemoryIdentityDirectory implements IdentityDirectory {
  private readonly byEmail = new Map<string, UserRecord>();

  add(user: UserRecord): void {
    this.byEmail.set(user.email.toLowerCase(), { ...user });
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const found = this.byEmail.get(email.toLowerCase());
    return found ? { ...found } : null;
  }
}
