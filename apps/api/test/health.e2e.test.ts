import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/configure-http';

describe('API health', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureHttp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'fable-api',
      simulated: true,
      realMoney: false,
    });
  });

  it('GET /health/ready skips unconfigured dependencies', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body.checks).toEqual({ database: 'skipped', redis: 'skipped' });
  });

  it('GET /metrics exposes the Prometheus registry', async () => {
    const response = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(response.text).toContain('fable_http_requests_total');
  });

  it('GET /modules states that only the ledger mutates balances', async () => {
    const response = await request(app.getHttpServer()).get('/modules').expect(200);
    const ledger = response.body.modules.find((mod: { name: string }) => mod.name === 'ledger');
    const casino = response.body.modules.find((mod: { name: string }) => mod.name === 'casino');
    expect(ledger).toMatchObject({ mutatesBalances: true, authoritativeForBalances: true });
    expect(casino).toMatchObject({ mutatesBalances: false, authoritativeForBalances: false });
    expect(response.body.realMoney).toBe(false);
  });
});
