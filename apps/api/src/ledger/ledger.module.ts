import { Module } from '@nestjs/common';
import { createPrismaClient, PrismaLedgerStore } from '@fable/database';
import {
  CasinoBoundary,
  InMemoryAuditSink,
  InMemoryLedgerStore,
  Ledger,
  SportsbookBoundary,
} from '@fable/domain';

export const LEDGER = Symbol('LEDGER');

/**
 * Wires the authoritative ledger.
 * When DATABASE_URL is set, journals go to Postgres in one transaction.
 * Otherwise the in-memory store keeps local boot and CI independent of Docker.
 * Casino and sportsbook receive the ledger. They are not given a database client.
 */
@Module({
  providers: [
    {
      provide: LEDGER,
      useFactory: (): Ledger => {
        const url = process.env.DATABASE_URL;
        if (url) {
          return new Ledger(new PrismaLedgerStore(createPrismaClient(url)));
        }
        return new Ledger(new InMemoryLedgerStore(new InMemoryAuditSink()));
      },
    },
    {
      provide: CasinoBoundary,
      inject: [LEDGER],
      useFactory: (ledger: Ledger) => new CasinoBoundary(ledger),
    },
    {
      provide: SportsbookBoundary,
      inject: [LEDGER],
      useFactory: (ledger: Ledger) => new SportsbookBoundary(ledger),
    },
  ],
  exports: [LEDGER, CasinoBoundary, SportsbookBoundary],
})
export class LedgerModule {}
