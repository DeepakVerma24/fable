import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ name: z.string().min(1) }));

  it('returns the parsed value', () => {
    expect(pipe.transform({ name: 'fable' })).toEqual({ name: 'fable' });
  });

  it('rejects a payload that does not match', () => {
    expect(() => pipe.transform({ name: '' })).toThrow(BadRequestException);
  });
});
