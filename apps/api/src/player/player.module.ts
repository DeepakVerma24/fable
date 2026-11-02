import { Module } from '@nestjs/common';
import { createPrismaClient, PrismaPlayerStore, PrismaBetStore } from '@fable/database';
import {
  DemoSportsbook,
  DemoWallet,
  InMemoryPlayerStore,
  Ledger,
  SportsbookBoundary,
} from '@fable/domain';

import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { AuthGuard, CookieCsrfGuard, SessionCsrfGuard } from '../auth/guards';
import { CatalogController } from '../catalog/catalog.controller';
import { FavoritesController } from '../favorites/favorites.controller';
import { FavoritesService } from '../favorites/favorites.service';
import { LEDGER, LedgerModule } from '../ledger/ledger.module';
import { PromotionsController } from '../promotions/promotions.controller';
import { BetController } from '../sports/bet.controller';
import { MemoryBetStore } from '../sports/memory-bet-store';
import { BET_STORE, BetService } from '../sports/bet.service';
import { SportsController } from '../sports/sports.controller';
import { WalletController } from '../wallet/wallet.controller';
import { WalletService } from '../wallet/wallet.service';
import { PLAYER_STORE } from './tokens';

@Module({
  imports: [LedgerModule],
  controllers: [
    AuthController,
    CatalogController,
    SportsController,
    BetController,
    WalletController,
    PromotionsController,
    FavoritesController,
  ],
  providers: [
    {
      provide: PLAYER_STORE,
      useFactory: () => {
        const url = process.env.DATABASE_URL;
        if (url) return new PrismaPlayerStore(createPrismaClient(url));
        return new InMemoryPlayerStore();
      },
    },
    {
      provide: DemoWallet,
      inject: [LEDGER],
      useFactory: (ledger: Ledger) => new DemoWallet(ledger),
    },
    {
      provide: DemoSportsbook,
      inject: [SportsbookBoundary],
      useFactory: (boundary: SportsbookBoundary) => new DemoSportsbook(boundary),
    },
    {
      provide: BET_STORE,
      inject: [LEDGER],
      useFactory: (ledger: Ledger) => {
        const url = process.env.DATABASE_URL;
        if (url) return new PrismaBetStore(createPrismaClient(url));
        if (process.env.FABLE_ENV === 'prod') throw new Error('Production requires PostgreSQL');
        return new MemoryBetStore(ledger);
      },
    },
    AuthService,
    BetService,
    WalletService,
    FavoritesService,
    AuthGuard,
    CookieCsrfGuard,
    SessionCsrfGuard,
  ],
})
export class PlayerModule {}
