import { PLATFORM_PING_JOB } from '@fable/domain';

export class BalanceMutationForbiddenError extends Error {
  constructor(jobName: string) {
    super(
      `Job ${jobName} is rejected. Balance changes are journals committed by the ledger module, not worker side effects.`,
    );
    this.name = 'BalanceMutationForbiddenError';
  }
}

export interface WorkerJob {
  name: string;
  data: unknown;
}

export interface WorkerLog {
  info(payload: Record<string, string>): void;
}

/**
 * Stub processor for the fable.jobs queue.
 * platform.ping is the only accepted job. Wallet and balance job names are refused.
 */
export async function handleJob(
  job: WorkerJob,
  log: WorkerLog,
): Promise<{ ok: true; simulated: true }> {
  if (
    job.name.startsWith('balance.') ||
    job.name.startsWith('wallet.') ||
    job.name === 'ledger.mutate'
  ) {
    throw new BalanceMutationForbiddenError(job.name);
  }
  if (job.name !== PLATFORM_PING_JOB) {
    throw new Error(
      `Unknown job ${job.name}. The foundation worker only accepts ${PLATFORM_PING_JOB}.`,
    );
  }
  log.info({ msg: 'platform ping', job: job.name });
  return { ok: true, simulated: true };
}
