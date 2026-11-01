import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { pino } from 'pino';

import { APP_ENV, loadEnv } from './config/env';
import { FoundationExceptionFilter } from './http/exception.filter';
import { HealthController } from './health/health.controller';
import { LedgerModule } from './ledger/ledger.module';
import { PlayerModule } from './player/player.module';
import { PlatformGateway } from './platform/platform.gateway';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: false,
        base: { service: 'fable-api', simulated: true },
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    LedgerModule,
    PlayerModule,
  ],
  controllers: [HealthController],
  providers: [
    PlatformGateway,
    { provide: APP_ENV, useFactory: () => loadEnv(process.env) },
    { provide: APP_FILTER, useClass: FoundationExceptionFilter },
  ],
})
export class AppModule {}
