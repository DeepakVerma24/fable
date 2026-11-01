import * as Sentry from '@sentry/node';

let enabled = false;

/** Starts Sentry only when SENTRY_DSN is present. Local and CI boots do not need a DSN. */
export function initSentry(service: string): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    enabled = false;
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.FABLE_ENV ?? 'dev',
    tracesSampleRate: 0,
    initialScope: { tags: { service, simulated: 'true' } },
  });
  enabled = true;
}

export function captureException(error: unknown): void {
  if (!enabled) return;
  Sentry.captureException(error);
}

export function sentryEnabled(): boolean {
  return enabled;
}
