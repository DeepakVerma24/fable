import { Controller, Get, Header, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { pingDatabase, pingRedis } from '@fable/database';
import { getMetricsRegistry, recordHttpRequest } from '@fable/observability';
import { moduleBoundaries } from '@fable/domain';

import { APP_ENV, type AppEnv } from '../config/env';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe. Does not check Postgres or Redis.' })
  @ApiOkResponse({ description: 'Process is up. Money movement stays simulated.' })
  health(): { status: 'ok'; service: 'fable-api'; simulated: true; realMoney: false } {
    recordHttpRequest({ route: '/health', method: 'GET', status: '200' });
    return { status: 'ok', service: 'fable-api', simulated: true, realMoney: false };
  }

  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe. Skips dependencies that are not configured.' })
  async ready(): Promise<{
    status: 'ok';
    checks: { database: string; redis: string };
    simulated: true;
  }> {
    const checks = {
      database: await this.check('database', this.env.databaseUrl, pingDatabase),
      redis: await this.check('redis', this.env.redisUrl, pingRedis),
    };
    return { status: 'ok', checks, simulated: true };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Prometheus text exposition.' })
  async metrics(): Promise<string> {
    return getMetricsRegistry().metrics();
  }

  @Get('modules')
  @ApiOperation({ summary: 'Module boundaries for this modular monolith.' })
  modules(): { simulated: true; realMoney: false; modules: typeof moduleBoundaries } {
    return { simulated: true, realMoney: false, modules: moduleBoundaries };
  }

  private async check(
    name: string,
    url: string | null,
    ping: (url: string) => Promise<void>,
  ): Promise<string> {
    if (!url) return 'skipped';
    try {
      await ping(url);
      return 'ok';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unavailable';
      throw new ServiceUnavailableException(`${name} check failed: ${message}`);
    }
  }
}
