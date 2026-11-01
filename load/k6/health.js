import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Opt-in smoke load script. CI does not run k6.
 * k6 is an external binary and a load test is not a correctness gate for this foundation.
 *
 *   k6 run load/k6/health.js
 */
export const options = {
  vus: 1,
  iterations: 1,
};

export default function health() {
  const base = __ENV.API_URL || 'http://127.0.0.1:4307';
  const response = http.get(`${base}/health`);
  check(response, {
    'status is 200': (result) => result.status === 200,
    'body says ok': (result) => String(result.body).includes('"status":"ok"'),
  });
  sleep(1);
}
