import { describe, expect, it } from 'vitest';

import { createLogger } from './logger';
import { getMetricsRegistry, recordHttpRequest } from './metrics';
import { startTelemetry } from './otel';
import { initSentry, sentryEnabled } from './sentry';

describe('observability bootstrap', () => {
  it('creates a JSON logger without a transport', () => {
    const logger = createLogger('fable-test');
    expect(logger.level).toBe(process.env.LOG_LEVEL ?? 'info');
  });

  it('does not enable Sentry or OpenTelemetry when they are unset', () => {
    delete process.env.SENTRY_DSN;
    delete process.env.OTEL_ENABLED;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    initSentry('fable-test');
    expect(sentryEnabled()).toBe(false);
    expect(() => startTelemetry('fable-test')).not.toThrow();
  });

  it('exposes a Prometheus registry', async () => {
    recordHttpRequest({ route: '/health', method: 'GET', status: '200' });
    const text = await getMetricsRegistry().metrics();
    expect(text).toContain('fable_http_requests_total');
  });
});
