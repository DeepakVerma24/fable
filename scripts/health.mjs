const url = process.env.HEALTH_URL ?? 'http://127.0.0.1:4307/health';

const response = await fetch(url);
const text = await response.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  console.error(`Health check returned non-JSON from ${url}: ${text}`);
  process.exit(1);
}

if (!response.ok || body.status !== 'ok') {
  console.error(JSON.stringify(body));
  process.exit(1);
}

console.log(JSON.stringify(body));
