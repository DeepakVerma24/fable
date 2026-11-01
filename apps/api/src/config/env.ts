import { z } from 'zod';

const schema = z.object({
  PORT: z.string().regex(/^\d+$/).optional(),
  FABLE_ENV: z.enum(['dev', 'test', 'prod']).optional(),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//)
    .optional(),
  REDIS_URL: z
    .string()
    .regex(/^redis(s)?:\/\//)
    .optional(),
  WEB_ORIGIN: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  SENTRY_DSN: z.string().optional(),
});

export interface AppEnv {
  port: number;
  fableEnv: 'dev' | 'test' | 'prod';
  databaseUrl: string | null;
  redisUrl: string | null;
  webOrigin: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  /** Always false. This process has no real-money mode. */
  realMoney: false;
  simulated: true;
}

export const APP_ENV = Symbol('APP_ENV');

export function loadEnv(source: NodeJS.ProcessEnv): AppEnv {
  const parsed = schema.parse(source);
  return {
    port: parsed.PORT ? Number(parsed.PORT) : 4307,
    fableEnv: parsed.FABLE_ENV ?? 'dev',
    databaseUrl: parsed.DATABASE_URL ?? null,
    redisUrl: parsed.REDIS_URL ?? null,
    webOrigin: parsed.WEB_ORIGIN ?? 'http://127.0.0.1:3847,http://localhost:3847',
    logLevel: parsed.LOG_LEVEL ?? 'info',
    realMoney: false,
    simulated: true,
  };
}
