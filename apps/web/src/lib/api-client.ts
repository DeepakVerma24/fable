export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const CSRF_COOKIE = 'fable_csrf';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const row = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  if (!row) return null;
  return decodeURIComponent(row.slice(name.length + 1));
}

let csrfMemory: string | null = null;

export function rememberCsrf(token: string | undefined): void {
  if (token) csrfMemory = token;
}

async function ensureCsrf(): Promise<string> {
  const existing = readCookie(CSRF_COOKIE) ?? csrfMemory;
  if (existing) return existing;
  const response = await fetch('/backend/auth/csrf', { credentials: 'include' });
  const body = (await response.json()) as { csrfToken?: string; message?: string };
  if (!response.ok || !body.csrfToken) {
    throw new ApiError(body.message ?? 'Could not start a secure form.', response.status);
  }
  csrfMemory = body.csrfToken;
  return body.csrfToken;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('x-fable-csrf', await ensureCsrf());
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  }
  const response = await fetch(`/backend${path}`, { ...init, headers, credentials: 'include' });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as { message?: unknown; csrfToken?: string }) : {};
  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.map(String).join('; ')
      : typeof data.message === 'string'
        ? data.message
        : `${path} returned ${response.status}`;
    throw new ApiError(message, response.status);
  }
  if (typeof data.csrfToken === 'string') csrfMemory = data.csrfToken;
  return data as T;
}
