import { randomBytes } from 'node:crypto';

import { Body, Controller, Get, Inject, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { ZodValidationPipe } from '../http/zod-validation.pipe';
import {
  CSRF_COOKIE,
  requestIsSecure,
  serializeCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  clearCookie,
  headerString,
  parseCookies,
  writeCookies,
  type CookieReply,
} from '../http/cookies';
import { assertWithinRate } from '../http/rate-limit';
import { AuthService, type PublicPlayer } from './auth.service';
import { AuthGuard, CookieCsrfGuard, SessionCsrfGuard, type PlayerRequest } from './guards';

const credentials = z.object({
  email: z.email('Enter a valid email address.').max(120),
  password: z.string().min(10, 'Use at least 10 characters.').max(128),
});

const registerSchema = credentials.extend({
  displayName: z.string().trim().min(1, 'Enter a display name.').max(40),
});

const loginSchema = credentials;

const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter a display name.').max(40),
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('csrf')
  @ApiOperation({ summary: 'Issue a readable CSRF cookie for anonymous forms.' })
  csrf(
    @Req() request: PlayerRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ): {
    csrfToken: string;
    simulated: true;
  } {
    const cookies = parseCookies(headerString(request.headers.cookie));
    const existing = cookies[CSRF_COOKIE];
    if (existing) return { csrfToken: existing, simulated: true };
    const csrfToken = randomBytes(32).toString('base64url');
    writeCookies(reply, [this.csrfCookie(request, csrfToken)]);
    return { csrfToken, simulated: true };
  }

  @Post('register')
  @UseGuards(CookieCsrfGuard)
  @ApiOperation({ summary: 'Create a player and a simulated opening balance.' })
  async register(
    @Body(new ZodValidationPipe(registerSchema))
    body: z.infer<typeof registerSchema>,
    @Req() request: PlayerRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<{ player: PublicPlayer; csrfToken: string; simulated: true }> {
    assertWithinRate(`register:${clientAddress(request)}`, 30, 10 * 60_000);
    const opened = await this.auth.register(body);
    this.attachSession(request, reply, opened.session.id, opened.session.csrfToken);
    return { player: opened.player, csrfToken: opened.session.csrfToken, simulated: true };
  }

  @Post('login')
  @UseGuards(CookieCsrfGuard)
  @ApiOperation({ summary: 'Open a session. Failures use one generic message.' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() request: PlayerRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<{ player: PublicPlayer; csrfToken: string; simulated: true }> {
    assertWithinRate(`login:${body.email.toLowerCase()}`, 20, 10 * 60_000);
    const opened = await this.auth.login(body.email, body.password);
    this.attachSession(request, reply, opened.session.id, opened.session.csrfToken);
    return { player: opened.player, csrfToken: opened.session.csrfToken, simulated: true };
  }

  @Post('logout')
  @UseGuards(AuthGuard, SessionCsrfGuard)
  @ApiOperation({ summary: 'Delete the server session and clear the session cookie.' })
  async logout(
    @Req() request: PlayerRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<{ ok: true; csrfToken: string; simulated: true }> {
    if (request.session) await this.auth.logout(request.session.id);
    const csrfToken = randomBytes(32).toString('base64url');
    const secure = this.secure(request);
    writeCookies(reply, [
      clearCookie(SESSION_COOKIE, secure),
      serializeCookie(CSRF_COOKIE, csrfToken, {
        httpOnly: false,
        maxAge: SESSION_MAX_AGE_SECONDS,
        secure,
      }),
    ]);
    return { ok: true, csrfToken, simulated: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Current player. Requires the session cookie.' })
  me(@Req() request: PlayerRequest): { player: PublicPlayer; expiresAt: string; simulated: true } {
    if (!request.player || !request.session) {
      throw new Error('Auth guard did not attach a player.');
    }
    return { player: request.player, expiresAt: request.session.expiresAt, simulated: true };
  }

  @Patch('profile')
  @UseGuards(AuthGuard, SessionCsrfGuard)
  @ApiOperation({ summary: 'Update the display name. The email stays put.' })
  async profile(
    @Body(new ZodValidationPipe(profileSchema)) body: z.infer<typeof profileSchema>,
    @Req() request: PlayerRequest,
  ): Promise<{ player: PublicPlayer; simulated: true }> {
    if (!request.player) throw new Error('Auth guard did not attach a player.');
    const player = await this.auth.rename(request.player.id, body.displayName);
    return { player, simulated: true };
  }

  private attachSession(
    request: PlayerRequest,
    reply: CookieReply,
    sessionId: string,
    csrfToken: string,
  ): void {
    const secure = this.secure(request);
    writeCookies(reply, [
      serializeCookie(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        maxAge: SESSION_MAX_AGE_SECONDS,
        secure,
      }),
      serializeCookie(CSRF_COOKIE, csrfToken, {
        httpOnly: false,
        maxAge: SESSION_MAX_AGE_SECONDS,
        secure,
      }),
    ]);
  }

  private csrfCookie(request: PlayerRequest, csrfToken: string): string {
    return serializeCookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: this.secure(request),
    });
  }

  private secure(request: PlayerRequest): boolean {
    return requestIsSecure(request.protocol, headerString(request.headers['x-forwarded-proto']));
  }
}

function clientAddress(request: PlayerRequest): string {
  const forwarded = headerString(request.headers['x-forwarded-for']);
  const first = forwarded.split(',')[0]?.trim();
  return first || request.ip || 'unknown';
}
