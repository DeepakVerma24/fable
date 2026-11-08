import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { OriginalRules } from '@fable/domain';
import { PostgresOriginalSessions } from '@fable/database';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/configure-http';
import { clearRateLimits } from '../src/http/rate-limit';
import { ORIGINAL_ENGINE } from '../src/casino/originals.controller';

const url = process.env.FABLE_CASINO_TEST_URL;
describe.skipIf(!url)('PostgreSQL-backed nonfinancial casino HTTP integration', () => {
  let app: NestFastifyApplication;
  let sessionId: string;
  let draws = 0;
  beforeAll(async () => {
    if (!url || !/^\/fable_casino_[a-z0-9_]+$/.test(new URL(url).pathname))
      throw new Error('Casino HTTP tests require a dedicated fable_casino_* database.');
    process.env.DATABASE_URL = url!;
    delete process.env.REDIS_URL;
    clearRateLimits();
    const store = new PostgresOriginalSessions(
      url,
      new OriginalRules(() => {
        draws++;
        return 0;
      }, randomUUID),
    );
    sessionId = await store.sessionId();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ORIGINAL_ENGINE)
      .useValue(store)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureHttp(app);
    await app.listen(0, '127.0.0.1');
  }, 30_000);
  afterAll(async () => {
    await app?.close();
  });

  async function register(name: string) {
    const csrf = await request(app.getHttpServer()).get('/auth/csrf').expect(200);
    const firstCookie = cookies(csrf);
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('cookie', firstCookie)
      .set('x-fable-csrf', csrf.body.csrfToken as string)
      .send({
        email: `${name}-${randomUUID()}@example.invalid`,
        displayName: name,
        password: 'a-long-password',
      })
      .expect(201);
    return { cookie: cookies(response), csrf: response.body.csrfToken as string };
  }
  it('requires authentication/CSRF and exposes only implemented playable games', async () => {
    await request(app.getHttpServer()).get('/casino/demo/session').expect(401);
    await request(app.getHttpServer()).post('/casino/demo/rounds').send({}).expect(401);
    const a = await register('Casino-auth');
    await request(app.getHttpServer())
      .post('/casino/demo/rounds')
      .set('cookie', a.cookie)
      .send({})
      .expect(403);
    const session = await request(app.getHttpServer())
      .get('/casino/demo/session')
      .set('cookie', a.cookie)
      .expect('cache-control', 'private, no-store')
      .expect(200);
    expect(session.body).toMatchObject({
      sessionId,
      financial: false,
      realMoney: false,
      persistence: 'postgresql',
    });
    const catalog = await request(app.getHttpServer())
      .get('/casino/games?availability=playable')
      .expect(200);
    expect(catalog.body.total).toBe(4);
    expect(
      catalog.body.items.every((game: { provider: string }) => game.provider === 'FABLE Originals'),
    ).toBe(true);
    const categories = await request(app.getHttpServer()).get('/casino/categories').expect(200);
    expect(categories.body.items.map((item: { slug: string }) => item.slug)).toEqual(
      expect.arrayContaining([
        'slots',
        'live',
        'table',
        'blackjack',
        'roulette',
        'baccarat',
        'game-shows',
        'originals',
      ]),
    );
  });

  it('isolates players, deduplicates simultaneous actions and never changes the wallet', async () => {
    const a = await register('Casino-A');
    const b = await register('Casino-B');
    const get = (path: string, actor = a) =>
      request(app.getHttpServer()).get(path).set('cookie', actor.cookie);
    const post = (path: string, body: object, actor = a) =>
      request(app.getHttpServer())
        .post(path)
        .set('cookie', actor.cookie)
        .set('x-fable-csrf', actor.csrf)
        .send(body);
    const wallet = (await get('/wallet').expect(200)).body;
    const ledger = (await get('/wallet/transactions').expect(200)).body;
    const dice = {
      sessionId,
      idempotencyKey: 'dice-round-key',
      gameId: 'paper-dice',
      options: { chance: 50 },
    };
    const duplicates = await Promise.all(
      Array.from({ length: 8 }, () => post('/casino/demo/rounds', dice).expect(201)),
    );
    for (const response of duplicates) expect(response.body).toEqual(duplicates[0]!.body);
    expect(draws).toBe(1);
    expect(duplicates[0]!.body).toMatchObject({
      returnPoints: 198,
      financial: false,
      realMoney: false,
    });
    await post('/casino/demo/rounds', { ...dice, options: { chance: 60 } }).expect(409);
    await get(`/casino/demo/rounds/${duplicates[0]!.body.id}`, b).expect(404);
    expect((await get('/casino/demo/rounds', b).expect(200)).body.items).toEqual([]);
    expect((await post('/casino/demo/rounds', dice, b).expect(201)).body.id).not.toBe(
      duplicates[0]!.body.id,
    );

    const mineStart = {
      sessionId,
      idempotencyKey: 'mines-start-key',
      gameId: 'fable-mines',
      options: { mines: 3 },
    };
    const mineRound = (await post('/casino/demo/rounds', mineStart).expect(201)).body;
    expect(JSON.stringify(mineRound)).not.toContain('locations');
    expect(JSON.stringify((await get('/casino/demo/rounds').expect(200)).body)).not.toContain(
      'locations',
    );
    const path = `/casino/demo/rounds/${mineRound.id}/actions`;
    await post(path, {
      sessionId,
      idempotencyKey: 'early-finish-key',
      type: 'finish',
      expectedVersion: 0,
    }).expect(400);
    await post('/casino/demo/rounds', { ...mineStart, idempotencyKey: 'second-mines-key' }).expect(
      409,
    );
    const reveal = {
      sessionId,
      idempotencyKey: 'reveal-cell-key',
      type: 'reveal',
      expectedVersion: 0,
      cell: 24,
    };
    const reveals = await Promise.all(
      Array.from({ length: 6 }, () => post(path, reveal).expect(201)),
    );
    for (const response of reveals) expect(response.body).toEqual(reveals[0]!.body);
    expect(reveals[0]!.body).toMatchObject({
      version: 1,
      returnPoints: 112,
      mines: { revealed: [24] },
    });
    await post(path, { ...reveal, idempotencyKey: 'stale-reveal-key', cell: 23 }).expect(409);
    await post(path, { ...reveal, expectedVersion: 1, idempotencyKey: 'other-user-key' }, b).expect(
      404,
    );
    const finish = {
      sessionId,
      idempotencyKey: 'finish-round-key',
      type: 'finish',
      expectedVersion: 1,
    };
    const finished = (await post(path, finish).expect(201)).body;
    expect(finished).toMatchObject({
      status: 'complete',
      version: 2,
      returnPoints: 112,
      mines: { locations: [0, 1, 2] },
    });
    expect((await post(path, finish).expect(201)).body).toEqual(finished);
    // A replay returns its original response; fetching current state returns the completed round.
    expect((await post(path, reveal).expect(201)).body.version).toBe(1);
    expect((await get(`/casino/demo/rounds/${mineRound.id}`).expect(200)).body).toEqual(finished);
    for (const [gameId, options, points] of [
      ['fable-plinko', {}, 500],
      ['fable-limbo', { target: 2 }, 200],
    ] as const) {
      expect(
        (
          await post('/casino/demo/rounds', {
            sessionId,
            idempotencyKey: `${gameId}-key`,
            gameId,
            options,
          }).expect(201)
        ).body.returnPoints,
      ).toBe(points);
    }
    await post('/casino/demo/rounds', { ...dice, sessionId: randomUUID() }).expect(410);
    await post('/casino/demo/rounds', {
      ...dice,
      idempotencyKey: 'preview-game-key',
      gameId: 'northline-reels',
    }).expect(404);
    await post('/casino/demo/rounds', { ...dice, outcome: 'hit', returnPoints: 9999 }).expect(400);
    expect((await get('/wallet').expect(200)).body).toEqual(wallet);
    expect((await get('/wallet/transactions').expect(200)).body).toEqual(ledger);
  });
});
function cookies(response: request.Response): string {
  const raw = response.headers['set-cookie'];
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((line) => line.split(';')[0]).join('; ');
}
