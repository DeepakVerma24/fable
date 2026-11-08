import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/configure-http';
import { clearRateLimits } from '../src/http/rate-limit';

describe('player API', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    clearRateLimits();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureHttp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('registers, isolates players, settles a demo bet, and rejects a suspended market', async () => {
    const ada = await register('ada@example.com', 'Ada North');
    const beau = await register('beau@example.com', 'Beau West');

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('cookie', ada.cookie)
      .expect(200);
    expect(me.body.player).toMatchObject({ email: 'ada@example.com', displayName: 'Ada North' });
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
    expect(me.body.player.password).toBeUndefined();

    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/wallet').expect(401);

    const wrong = await request(app.getHttpServer())
      .post('/auth/login')
      .set('cookie', ada.cookie)
      .set('x-fable-csrf', ada.csrf)
      .send({ email: 'missing@example.com', password: 'not-the-password' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.message).toBe('Email or password is incorrect.');

    const badPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .set('cookie', ada.cookie)
      .set('x-fable-csrf', ada.csrf)
      .send({ email: 'ada@example.com', password: 'still-not-right' });
    expect(badPassword.body.message).toBe(wrong.body.message);

    const noCsrf = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'a-long-password' });
    expect(noCsrf.status).toBe(403);

    const wallet = await request(app.getHttpServer())
      .get('/wallet')
      .set('cookie', ada.cookie)
      .expect(200);
    expect(wallet.body).toMatchObject({
      currency: 'FBU',
      withdrawable: false,
      realMoney: false,
      availableMinor: '100000',
      reservedMinor: '0',
    });

    const beauWallet = await request(app.getHttpServer())
      .get('/wallet/transactions')
      .set('cookie', beau.cookie)
      .expect(200);
    expect(beauWallet.body.items).toHaveLength(1);
    expect(beauWallet.body.items[0].reference).toContain(beau.id);

    const games = await request(app.getHttpServer())
      .get('/casino/games')
      .query({ category: 'slots', pageSize: 2 })
      .expect(200);
    expect(games.body.total).toBeGreaterThan(2);
    expect(games.body.items).toHaveLength(2);
    expect(games.body.items.every((game: { playable: boolean }) => game.playable === false)).toBe(
      true,
    );

    const preview = await request(app.getHttpServer())
      .get('/casino/games/northline-reels')
      .expect(200);
    expect(preview.body.provider).toBe('FABLE Preview');

    const event = await request(app.getHttpServer())
      .get('/sports/events/fbl-north-harbor')
      .expect(200);
    expect(event.body.liveFeed).toBe(false);
    expect(event.body.name).toContain('North Harbor');

    const suspended = await request(app.getHttpServer())
      .post('/demo/bets')
      .set('cookie', ada.cookie)
      .set('x-fable-csrf', ada.csrf)
      .send({
        idempotencyKey: 'ada-suspended-1',
        selectionId: 'bsk-archive-winner-home',
        stakeMinor: '1000',
      });
    expect(suspended.status).toBe(409);

    const loss = await request(app.getHttpServer())
      .post('/demo/bets')
      .set('cookie', ada.cookie)
      .set('x-fable-csrf', ada.csrf)
      .send({
        idempotencyKey: 'ada-loss-home-1',
        selectionId: 'fbl-north-harbor-result-home',
        stakeMinor: '1000',
      })
      .expect(201);
    expect(loss.body).toMatchObject({
      outcome: 'loss',
      outcomeSource: 'deterministic-demo',
      simulated: true,
      realMoney: false,
      payoutMinor: '0',
    });

    const replay = await request(app.getHttpServer())
      .post('/demo/bets')
      .set('cookie', ada.cookie)
      .set('x-fable-csrf', ada.csrf)
      .send({
        idempotencyKey: 'ada-loss-home-1',
        selectionId: 'fbl-north-harbor-result-home',
        stakeMinor: '1000',
      })
      .expect(201);
    expect(replay.body.id).toBe(loss.body.id);

    const afterLoss = await request(app.getHttpServer())
      .get('/wallet')
      .set('cookie', ada.cookie)
      .expect(200);
    expect(afterLoss.body.availableMinor).toBe('99000');
    expect(afterLoss.body.reservedMinor).toBe('0');

    const win = await request(app.getHttpServer())
      .post('/demo/bets')
      .set('cookie', ada.cookie)
      .set('x-fable-csrf', ada.csrf)
      .send({
        idempotencyKey: 'ada-win-away-1',
        selectionId: 'fbl-north-harbor-result-away',
        stakeMinor: '1000',
      })
      .expect(201);
    expect(win.body.outcome).toBe('win');
    expect(win.body.payoutMinor).toBe('4200');

    const afterWin = await request(app.getHttpServer())
      .get('/wallet')
      .set('cookie', ada.cookie)
      .expect(200);
    expect(afterWin.body.availableMinor).toBe('102200');

    const beauAfter = await request(app.getHttpServer())
      .get('/wallet')
      .set('cookie', beau.cookie)
      .expect(200);
    expect(beauAfter.body.availableMinor).toBe('100000');

    await request(app.getHttpServer())
      .put('/favorites/northline-reels')
      .set('cookie', ada.cookie)
      .set('x-fable-csrf', ada.csrf)
      .expect(200);
    const adaFavorites = await request(app.getHttpServer())
      .get('/favorites')
      .set('cookie', ada.cookie)
      .expect(200);
    expect(adaFavorites.body.items).toHaveLength(1);
    const beauFavorites = await request(app.getHttpServer())
      .get('/favorites')
      .set('cookie', beau.cookie)
      .expect(200);
    expect(beauFavorites.body.items).toHaveLength(0);

    const loggedOut = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('cookie', ada.cookie)
      .set('x-fable-csrf', ada.csrf)
      .expect(201);
    expect(loggedOut.body.ok).toBe(true);
    const sessionCleared = cookieValue(loggedOut, 'fable_session');
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('cookie', `fable_session=${sessionCleared}`)
      .expect(401);
  }, 30_000);

  it('serves cricket formats and rejects closed or unsupported cricket selections while replaying an enabled single', async () => {
    const player = await register('cricket@example.invalid', 'Cricket player');
    const fixtures = await request(app.getHttpServer()).get('/sports/cricket/events').expect(200);
    expect(fixtures.body.items).toHaveLength(4);
    const named = await request(app.getHttpServer())
      .get('/sports/cricket/events')
      .query({ competition: 'Indian Premier League (IPL)' })
      .expect(200);
    expect(named.body.items).toHaveLength(0);
    const completed = await request(app.getHttpServer())
      .get('/sports/cricket/events')
      .query({ phase: 'completed' })
      .expect(200);
    expect(completed.body.items[0].id).toBe('crk-archive-test');
    const input = {
      idempotencyKey: 'cricket-single-0001',
      selectionId: 'crk-ivory-t20-winner-home',
      stakeMinor: '1000',
    };
    const place = (body: typeof input) =>
      request(app.getHttpServer())
        .post('/demo/bets')
        .set('cookie', player.cookie)
        .set('x-fable-csrf', player.csrf)
        .send(body);
    const first = await place(input).expect(201);
    expect(first.body).toMatchObject({
      simulated: true,
      realMoney: false,
      status: 'settled',
      eventId: 'crk-ivory-t20',
      decimalOdds: '1.85',
    });
    const again = await place(input).expect(201);
    expect(again.body).toEqual(first.body);
    for (const selectionId of [
      'crk-archive-test-winner-home',
      'crk-coast-t10-winner-home',
      'crk-ivory-t20-preview-0-home',
    ]) {
      await place({ ...input, idempotencyKey: `reject-${selectionId}`, selectionId }).expect(404);
    }
    const history = await request(app.getHttpServer())
      .get('/demo/bets')
      .set('cookie', player.cookie)
      .expect(200);
    expect(history.body.items).toHaveLength(1);
  });

  async function register(email: string, displayName: string) {
    const csrf = await request(app.getHttpServer()).get('/auth/csrf').expect(200);
    const cookie = cookiePair(csrf, 'fable_csrf');
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('cookie', cookie)
      .set('x-fable-csrf', csrf.body.csrfToken as string)
      .send({ email, password: 'a-long-password', displayName })
      .expect(201);
    const lines = cookieLines(response);
    const session = lines.find((line) => line.startsWith('fable_session='));
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Lax/);
    expect(lines.find((line) => line.startsWith('fable_csrf='))).not.toMatch(/HttpOnly/);
    expect(JSON.stringify(response.body)).not.toContain('password');
    return {
      cookie: mergeCookies(cookie, response),
      csrf: response.body.csrfToken as string,
      id: response.body.player.id as string,
    };
  }
});

function cookieLines(response: request.Response): string[] {
  const raw = response.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function cookiePair(response: request.Response, name: string): string {
  const line = cookieLines(response).find((item) => item.startsWith(`${name}=`));
  if (!line) throw new Error(`missing ${name}`);
  return line.split(';')[0] ?? '';
}

function cookieValue(response: request.Response, name: string): string {
  const pair = cookiePair(response, name);
  return decodeURIComponent(pair.slice(name.length + 1));
}

function mergeCookies(existing: string, response: request.Response): string {
  const jar = new Map<string, string>();
  for (const part of existing.split(';')) {
    const trimmed = part.trim();
    const index = trimmed.indexOf('=');
    if (index > 0) jar.set(trimmed.slice(0, index), trimmed.slice(index + 1));
  }
  for (const line of cookieLines(response)) {
    const pair = line.split(';')[0] ?? '';
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}
