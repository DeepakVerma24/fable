import { Inject, Injectable } from '@nestjs/common';
import {
  DEMO_CURRENCY,
  DemoWallet,
  derivedBalanceMinor,
  holdAccount,
  Ledger,
  walletAccount,
  type PostedJournal,
} from '@fable/domain';

import { LEDGER } from '../ledger/ledger.module';

export interface WalletSummary {
  simulated: true;
  realMoney: false;
  withdrawable: false;
  currency: typeof DEMO_CURRENCY;
  label: 'Fable demo units';
  disclaimer: string;
  availableMinor: string;
  reservedMinor: string;
  totalMinor: string;
}

export interface WalletTransaction {
  id: string;
  reference: string;
  kind: string;
  status: 'posted';
  simulated: true;
  postedAt: string;
  description: string;
  amountMinor: string;
  currency: typeof DEMO_CURRENCY;
}

@Injectable()
export class WalletService {
  constructor(
    @Inject(LEDGER) private readonly ledger: Ledger,
    @Inject(DemoWallet) private readonly wallet: DemoWallet,
  ) {}

  async summary(userId: string): Promise<WalletSummary> {
    await this.wallet.grant(userId);
    const lines = await this.lines();
    const available = derivedBalanceMinor(lines, walletAccount(userId));
    const reserved = derivedBalanceMinor(lines, holdAccount(userId));
    return {
      simulated: true,
      realMoney: false,
      withdrawable: false,
      currency: DEMO_CURRENCY,
      label: 'Fable demo units',
      disclaimer: 'Demo units cannot be withdrawn, deposited, or converted to money.',
      availableMinor: available.toString(),
      reservedMinor: reserved.toString(),
      totalMinor: (available + reserved).toString(),
    };
  }

  async transactions(userId: string): Promise<WalletTransaction[]> {
    await this.wallet.grant(userId);
    const availableCode = walletAccount(userId);
    const reservedCode = holdAccount(userId);
    const journals = await this.ledger.list();
    return journals
      .filter((journal) =>
        journal.lines.some(
          (line) => line.accountCode === availableCode || line.accountCode === reservedCode,
        ),
      )
      .map((journal) => describe(journal, availableCode));
  }

  private async lines() {
    const journals = await this.ledger.list();
    return journals.flatMap((journal) => journal.lines);
  }
}

function describe(journal: PostedJournal, availableCode: string): WalletTransaction {
  let net = 0n;
  for (const line of journal.lines) {
    if (line.accountCode !== availableCode) continue;
    net += line.direction === 'CREDIT' ? line.amountMinor : -line.amountMinor;
  }
  return {
    id: journal.id,
    reference: journal.idempotencyKey,
    kind: journal.kind,
    status: 'posted',
    simulated: true,
    postedAt: journal.postedAt,
    description: descriptionFor(journal.idempotencyKey, net),
    amountMinor: net.toString(),
    currency: DEMO_CURRENCY,
  };
}

function descriptionFor(reference: string, net: bigint): string {
  if (reference.startsWith('demo-grant-')) return 'Opening demo balance';
  if (reference.startsWith('bet-rsv-')) return 'Demo stake reserved';
  if (reference.startsWith('bet-stl-')) {
    return net > 0n ? 'Demo settlement credited' : 'Demo stake settled to the house';
  }
  return net >= 0n ? 'Simulated credit' : 'Simulated debit';
}
