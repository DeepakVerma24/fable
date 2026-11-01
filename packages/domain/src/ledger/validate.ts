import {
  JOURNAL_KINDS,
  LedgerError,
  markValidated,
  type JournalDraft,
  type JournalLine,
  type PostedJournal,
  type ValidatedJournal,
} from './types';

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const ACCOUNT_PATTERN = /^[a-z0-9_.:-]{1,64}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MAX_LINES = 32;

function copyLine(line: JournalLine): JournalLine {
  return {
    accountCode: line.accountCode,
    direction: line.direction,
    amountMinor: line.amountMinor,
    currency: line.currency,
  };
}

export function validateJournal(draft: JournalDraft): ValidatedJournal {
  if (draft.simulated !== true) {
    throw new LedgerError(
      'real_money_disabled',
      'Real-money journals are disabled. Only simulated journals are accepted.',
    );
  }

  if (!JOURNAL_KINDS.includes(draft.kind)) {
    throw new LedgerError('kind', 'Journal kind is not one of the simulated kinds.');
  }

  if (!KEY_PATTERN.test(draft.idempotencyKey)) {
    throw new LedgerError(
      'idempotency_key',
      'Idempotency key must be 8 to 128 characters of letters, digits, and . _ : -',
    );
  }

  if (draft.lines.length < 2) {
    throw new LedgerError('lines', 'A journal needs at least two lines so it can balance.');
  }
  if (draft.lines.length > MAX_LINES) {
    throw new LedgerError('lines', `A journal cannot exceed ${MAX_LINES} lines.`);
  }

  const lines = draft.lines.map(validateLine);
  const currency = lines[0]?.currency;
  if (!currency) {
    throw new LedgerError('currency', 'A journal needs a currency.');
  }

  let debit = 0n;
  let credit = 0n;
  for (const line of lines) {
    if (line.currency !== currency) {
      throw new LedgerError('currency', 'Every line in a journal must use the same currency.');
    }
    if (line.direction === 'DEBIT') debit += line.amountMinor;
    else credit += line.amountMinor;
  }
  if (debit !== credit) {
    throw new LedgerError(
      'unbalanced',
      `Journal is not balanced. Debits ${debit.toString()} differ from credits ${credit.toString()}.`,
    );
  }

  return markValidated({
    idempotencyKey: draft.idempotencyKey,
    kind: draft.kind,
    lines,
    simulated: true,
    actorId: draft.actorId ?? null,
  });
}

function validateLine(line: JournalLine): JournalLine {
  if (!ACCOUNT_PATTERN.test(line.accountCode)) {
    throw new LedgerError(
      'account',
      'Account codes are lowercase namespaced identifiers, up to 64 characters.',
    );
  }
  if (line.direction !== 'DEBIT' && line.direction !== 'CREDIT') {
    throw new LedgerError('amount', 'Line direction must be DEBIT or CREDIT.');
  }
  if (typeof line.amountMinor !== 'bigint' || line.amountMinor <= 0n) {
    throw new LedgerError(
      'amount',
      'amountMinor must be a positive bigint in minor currency units.',
    );
  }
  if (!CURRENCY_PATTERN.test(line.currency)) {
    throw new LedgerError('currency', 'Currency must be a three-letter uppercase ISO code.');
  }
  return copyLine(line);
}

export function assertSamePayload(expected: ValidatedJournal, posted: PostedJournal): void {
  if (expected.kind !== posted.kind || expected.actorId !== posted.actorId) {
    throw conflict(expected.idempotencyKey);
  }
  if (expected.lines.length !== posted.lines.length) {
    throw conflict(expected.idempotencyKey);
  }
  for (let index = 0; index < expected.lines.length; index += 1) {
    const left = expected.lines[index];
    const right = posted.lines[index];
    if (!left || !right) throw conflict(expected.idempotencyKey);
    if (
      left.accountCode !== right.accountCode ||
      left.direction !== right.direction ||
      left.amountMinor !== right.amountMinor ||
      left.currency !== right.currency
    ) {
      throw conflict(expected.idempotencyKey);
    }
  }
}

function conflict(key: string): LedgerError {
  return new LedgerError(
    'idempotency_conflict',
    `Idempotency key ${key} was already used with a different journal.`,
  );
}
