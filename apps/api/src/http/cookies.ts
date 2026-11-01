export const SESSION_COOKIE = 'fable_session';
export const CSRF_COOKIE = 'fable_csrf';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

export function headerString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function serializeCookie(
  name: string,
  value: string,
  options: { httpOnly: boolean; maxAge: number; secure: boolean },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${options.maxAge}`,
  ];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, '', { httpOnly: name === SESSION_COOKIE, maxAge: 0, secure });
}

export interface CookieReply {
  raw: {
    setHeader(name: string, value: string | readonly string[]): void;
  };
}

export function writeCookies(reply: CookieReply, cookies: readonly string[]): void {
  reply.raw.setHeader('Set-Cookie', cookies);
}

export function requestIsSecure(protocol: string, forwarded: string | undefined): boolean {
  if (protocol === 'https') return true;
  return forwarded?.split(',')[0]?.trim() === 'https';
}
