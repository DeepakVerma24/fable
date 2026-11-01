import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { initSentry, loadRootEnv, shutdownTelemetry, startTelemetry } from '@fable/observability';

import { AppModule } from './app.module';
import { APP_ENV, type AppEnv } from './config/env';
import { configureHttp } from './configure-http';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  initSentry('fable-api');
  startTelemetry('fable-api');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await configureHttp(app);

  const env = app.get<AppEnv>(APP_ENV);
  app
    .get(Logger)
    .log(
      `FABLE API listening on ${env.port} (${env.fableEnv}, simulated=${String(env.simulated)}, realMoney=${String(env.realMoney)})`,
    );
  await app.listen(env.port, '0.0.0.0');

  const shutdown = async () => {
    await app.close();
    await shutdownTelemetry();
  };
  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });
}

void bootstrap();
