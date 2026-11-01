import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      throw new BadRequestException(messages);
    }
    return parsed.data;
  }
}
