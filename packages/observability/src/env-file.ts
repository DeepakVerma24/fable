import path from 'node:path';

import { config } from 'dotenv';

/**
 * Load the repo-root env file, then an optional package-local file.
 * Missing files are ignored. Existing process env wins over the root file
 * unless the local file sets override.
 */
export function loadRootEnv(cwd = process.cwd()): void {
  config({ path: path.resolve(cwd, '../../.env') });
  config({ path: path.resolve(cwd, '.env'), override: true });
}
