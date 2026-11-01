import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derived) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derived);
    });
  });
}

/** OWASP-aligned interactive scrypt parameters. Node's built-in, so there is no native addon. */
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await derive(password, salt, KEY_LENGTH, {
    cost: COST,
    blockSize: BLOCK_SIZE,
    parallelization: PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    'scrypt',
    String(COST),
    String(BLOCK_SIZE),
    String(PARALLELIZATION),
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  const saltPart = parts[4];
  const hashPart = parts[5];
  if (!saltPart || !hashPart || !Number.isInteger(cost) || cost < 2) return false;
  if (!Number.isInteger(blockSize) || !Number.isInteger(parallelization)) return false;
  const salt = Buffer.from(saltPart, 'base64url');
  const expected = Buffer.from(hashPart, 'base64url');
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await derive(password, salt, expected.length, {
    cost,
    blockSize,
    parallelization,
    maxmem: 64 * 1024 * 1024,
  });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
