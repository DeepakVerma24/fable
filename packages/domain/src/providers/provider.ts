export interface ProviderRound {
  id: string;
  provider: string;
  simulated: true;
}

export interface GameProvider {
  readonly name: string;
  readonly mode: 'mock';
  fetchRound(roundId: string): Promise<ProviderRound>;
}

/**
 * Mock adapter. It never calls a remote casino or sports provider.
 * A future adapter implements GameProvider and stays behind this boundary.
 */
export class MockGameProvider implements GameProvider {
  readonly mode = 'mock' as const;

  constructor(readonly name: string) {}

  async fetchRound(roundId: string): Promise<ProviderRound> {
    const id = roundId.trim();
    if (!id) {
      throw new Error('A provider round id is required.');
    }
    return { id, provider: this.name, simulated: true };
  }
}
