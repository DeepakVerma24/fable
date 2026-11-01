import { Counter, Registry, collectDefaultMetrics } from '@prometheus-io/client';

let registry: Registry | undefined;
let httpRequests: Counter<'route' | 'method' | 'status'> | undefined;

export function getMetricsRegistry(): Registry {
  if (!registry) {
    registry = new Registry();
    registry.setDefaultLabels({ simulated: 'true' });
    collectDefaultMetrics({ register: registry });
    httpRequests = new Counter({
      name: 'fable_http_requests_total',
      help: 'HTTP requests recorded by foundation handlers.',
      labelNames: ['route', 'method', 'status'],
      registers: [registry],
    });
  }
  return registry;
}

export function recordHttpRequest(labels: { route: string; method: string; status: string }): void {
  getMetricsRegistry();
  httpRequests?.inc(labels);
}
