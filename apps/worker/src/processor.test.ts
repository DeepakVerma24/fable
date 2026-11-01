import { PLATFORM_PING_JOB } from '@fable/domain';
import { describe, expect, it } from 'vitest';

import { BalanceMutationForbiddenError, handleJob } from './processor';

const log = { info: () => undefined };

describe('worker processor', () => {
  it('acks the platform ping job', async () => {
    await expect(handleJob({ name: PLATFORM_PING_JOB, data: null }, log)).resolves.toEqual({
      ok: true,
      simulated: true,
    });
  });

  it('refuses jobs that would change a balance', async () => {
    await expect(
      handleJob({ name: 'wallet.credit', data: { amount: 1 } }, log),
    ).rejects.toBeInstanceOf(BalanceMutationForbiddenError);
    await expect(handleJob({ name: 'balance.set', data: {} }, log)).rejects.toBeInstanceOf(
      BalanceMutationForbiddenError,
    );
  });
});
