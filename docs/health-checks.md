# Health checks

## Liveness

`GET /health`

```json
{ "status": "ok", "service": "fable-api", "simulated": true, "realMoney": false }
```

This is process liveness. It does not ping Postgres or Redis. Compose uses it as the API healthcheck. `pnpm health` fetches the same URL and exits non-zero unless `status` is `ok`.

## Readiness

`GET /health/ready`

```json
{ "status": "ok", "checks": { "database": "skipped", "redis": "skipped" }, "simulated": true }
```

A dependency is `skipped` when its URL is unset, and `ok` when a ping succeeds. A configured dependency that fails returns 503. Readiness is allowed to fail in local dev when `.env` points at a database that is not running. Liveness still returns ok.

## Other probes

| Path             | Role                                                                                |
| ---------------- | ----------------------------------------------------------------------------------- |
| `GET /metrics`   | Prometheus text from `@prometheus-io/client`, including `fable_http_requests_total` |
| `GET /modules`   | Module boundary map. `mutatesBalances` is true only for the ledger                  |
| `GET /docs`      | OpenAPI UI                                                                          |
| Socket.IO `ping` | Gateway stub. Replies `pong` and does not accept wagers                             |

The worker does not expose HTTP. Its health is "the process is up". Without Redis it logs that the queue is disconnected and waits for a signal.

Grafana can scrape `/metrics` if you run it yourself. It is not started by Compose.
