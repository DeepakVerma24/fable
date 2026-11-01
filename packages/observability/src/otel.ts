import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | undefined;

/**
 * OpenTelemetry is off unless OTEL_ENABLED=true or an OTLP endpoint is set.
 * There is no collector in the default compose file. Grafana is documented
 * as an optional local add-on, not a required service.
 */
export function startTelemetry(serviceName: string): void {
  if (sdk) return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const enabled = process.env.OTEL_ENABLED === 'true' || Boolean(endpoint);
  if (!enabled) return;

  const url = endpoint ? `${endpoint.replace(/\/$/, '')}/v1/traces` : undefined;
  sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter(url ? { url } : {}),
  });
  sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
}
