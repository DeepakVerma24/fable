import { describe, it } from 'vitest';

const enabled = process.env.FABLE_TESTCONTAINERS === '1';

/**
 * Docker-backed integration tests stay off unless someone opts in.
 * This sandbox and the default CI job do not run a Docker daemon for Testcontainers.
 */
describe.skipIf(!enabled)('testcontainers', () => {
  it('requires the optional package and a running Docker daemon', () => {
    throw new Error(
      'FABLE_TESTCONTAINERS=1 but @testcontainers/postgresql is not installed. See docs/local-development.md.',
    );
  });
});
