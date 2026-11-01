import { Worker } from 'bullmq';
import { createBullConnection } from '@fable/database';
import { JOB_QUEUE_NAME } from '@fable/domain';
import { createLogger, loadRootEnv, shutdownTelemetry, startTelemetry } from '@fable/observability';

import { handleJob } from './processor';

async function main(): Promise<void> {
  loadRootEnv();
  startTelemetry('fable-worker');
  const logger = createLogger('fable-worker');
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn({
      msg: 'REDIS_URL is not set. Worker is idle and is not connected to fable.jobs.',
    });
    await new Promise<void>((resolve) => {
      const stop = () => resolve();
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    await shutdownTelemetry();
    return;
  }

  const connection = createBullConnection(redisUrl);
  const worker = new Worker(
    JOB_QUEUE_NAME,
    async (job) =>
      handleJob(
        { name: job.name, data: job.data },
        {
          info(payload) {
            logger.info(payload);
          },
        },
      ),
    { connection },
  );

  worker.on('failed', (job, error) => {
    logger.error({ msg: 'job failed', job: job?.name ?? 'unknown', error: error.message });
  });

  logger.info({ msg: 'worker connected', queue: JOB_QUEUE_NAME });

  const shutdown = async () => {
    await worker.close();
    connection.disconnect();
    await shutdownTelemetry();
  };
  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

void main();
