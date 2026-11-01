import { NextResponse, type NextRequest } from 'next/server';

const protectedPaths = ['/wallet', '/transactions', '/profile', '/settings', '/favorites'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsSession = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!needsSession) return NextResponse.next();
  if (request.cookies.get('fable_session')?.value) return NextResponse.next();
  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/wallet', '/transactions', '/profile', '/settings', '/favorites'],
};
