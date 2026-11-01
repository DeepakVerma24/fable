import { Redis } from 'ioredis';

/** General client. Callers connect explicitly and close when the ping is done. */
export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 2000,
    enableReadyCheck: true,
  });
}

/**
 * BullMQ requires maxRetriesPerRequest to be null so blocking commands
 * are not failed by the client's retry cap.
 */
export function createBullConnection(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2000,
  });
}

export async function pingRedis(url: string): Promise<void> {
  const client = createRedisClient(url);
  try {
    await client.connect();
    const result = await client.ping();
    if (result !== 'PONG') {
      throw new Error('Redis ping did not return PONG.');
    }
  } finally {
    client.disconnect();
  }
}
