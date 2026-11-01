import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { PlayerSession, PlayerStore } from '@fable/domain';

import { headerString, parseCookies, SESSION_COOKIE } from '../http/cookies';
import { PLAYER_STORE } from '../player/tokens';
import { toPublicPlayer, type PublicPlayer } from './auth.service';

export interface PlayerRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  protocol: string;
  ip: string;
  player?: PublicPlayer;
  session?: PlayerSession;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(PLAYER_STORE) private readonly players: PlayerStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlayerRequest>();
    const cookies = parseCookies(headerString(request.headers.cookie));
    const sessionId = cookies[SESSION_COOKIE];
    const session = sessionId ? await this.players.findSession(sessionId) : null;
    if (!session) {
      throw new UnauthorizedException('Sign in required.');
    }
    const player = await this.players.findById(session.userId);
    if (!player) {
      throw new UnauthorizedException('Sign in required.');
    }
    request.player = toPublicPlayer(player);
    request.session = session;
    return true;
  }
}

@Injectable()
export class CookieCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PlayerRequest>();
    const cookies = parseCookies(headerString(request.headers.cookie));
    const header = headerString(request.headers['x-fable-csrf']);
    if (!cookies.fable_csrf || header !== cookies.fable_csrf) {
      throw new ForbiddenException('CSRF check failed.');
    }
    return true;
  }
}

@Injectable()
export class SessionCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PlayerRequest>();
    const header = headerString(request.headers['x-fable-csrf']);
    if (!request.session || header !== request.session.csrfToken) {
      throw new ForbiddenException('CSRF check failed.');
    }
    return true;
  }
}
