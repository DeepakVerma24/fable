import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { APP_ENV, type AppEnv } from './config/env';

export async function configureHttp(app: NestFastifyApplication): Promise<void> {
  const env = app.get<AppEnv>(APP_ENV);
  await app.register(helmet, { contentSecurityPolicy: false });
  app.enableCors({
    origin: env.webOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });
  const config = new DocumentBuilder()
    .setTitle('FABLE API')
    .setDescription(
      'FABLE player API. Demo catalog, simulated wallet, and demo bets. No real-money wagering.',
    )
    .setVersion('0.1.0')
    .addTag('health')
    .build();
  const document = SwaggerModule.createDocument(app as unknown as INestApplication, config);
  SwaggerModule.setup('docs', app as unknown as INestApplication, document);
}
