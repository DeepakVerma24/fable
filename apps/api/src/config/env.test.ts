import { describe, expect, it } from 'vitest';

import { loadEnv } from './env';

describe('loadEnv', () => {
  it('defaults to a simulated dev process', () => {
    const env = loadEnv({});
    expect(env).toMatchObject({
      port: 4307,
      fableEnv: 'dev',
      databaseUrl: null,
      redisUrl: null,
      realMoney: false,
      simulated: true,
    });
  });

  it('ignores any attempt to enable real money through the environment', () => {
    const env = loadEnv({ REAL_MONEY: 'true', PORT: '4307' });
    expect(env.realMoney).toBe(false);
    expect(env.simulated).toBe(true);
  });
});
