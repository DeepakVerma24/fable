import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DemoBetOperations, DemoBetError, LedgerError, type BetStore } from '@fable/domain';
export const BET_STORE = Symbol('BET_STORE');
export type { DemoBetRecord } from '@fable/domain';
@Injectable()
export class BetService extends DemoBetOperations {
  constructor(@Inject(BET_STORE) store: BetStore) {
    super(store);
  }
  override async place(...args: Parameters<DemoBetOperations['place']>) {
    try {
      return await super.place(...args);
    } catch (error) {
      return translate(error);
    }
  }
  override async transition(...args: Parameters<DemoBetOperations['transition']>) {
    try {
      return await super.transition(...args);
    } catch (error) {
      return translate(error);
    }
  }
}
function translate(error: unknown): never {
  if (error instanceof DemoBetError || error instanceof LedgerError) {
    if (error.code === 'not_found') throw new NotFoundException(error.message);
    if (error.code === 'conflict' || error.code === 'idempotency_conflict')
      throw new ConflictException(error.message);
    throw new BadRequestException(error.message);
  }
  throw error;
}
