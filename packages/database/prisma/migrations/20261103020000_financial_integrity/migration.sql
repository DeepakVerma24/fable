BEGIN;
-- Refuse to bless already-corrupted history. Reconcile using auditable journals first.
DO $$ BEGIN
 IF EXISTS (SELECT t.id FROM ledger_transactions t LEFT JOIN ledger_entries e ON e.transaction_id=t.id
 GROUP BY t.id HAVING count(e.id)<2 OR count(DISTINCT e.currency)<>1 OR
 COALESCE(sum(CASE WHEN e.direction='DEBIT' THEN e.amount_minor ELSE -e.amount_minor END),0)<>0) THEN
   RAISE EXCEPTION 'historical journal imbalance requires reconciliation';
 END IF;
 IF EXISTS (SELECT 1 FROM ledger_entries e JOIN ledger_accounts a ON a.id=e.account_id WHERE e.currency<>a.currency) THEN
   RAISE EXCEPTION 'historical account currency mismatch requires reconciliation';
 END IF;
 IF EXISTS (SELECT a.id FROM ledger_accounts a JOIN ledger_entries e ON e.account_id=a.id WHERE a.type='USER_WALLET'
 GROUP BY a.id HAVING sum(CASE WHEN e.direction='CREDIT' THEN e.amount_minor ELSE -e.amount_minor END)<0) THEN
   RAISE EXCEPTION 'historical negative wallet requires reconciliation';
 END IF;
END $$;
-- Seal historical journals. New lines must be written in the creating transaction.
ALTER TABLE ledger_transactions ADD COLUMN posting_xid xid8;
ALTER TABLE ledger_transactions ALTER COLUMN posting_xid SET DEFAULT pg_current_xact_id();
ALTER TABLE ledger_entries ADD COLUMN position integer NOT NULL DEFAULT 0;
-- Historical rows have no defined ordering; new postings have explicit positions.
CREATE UNIQUE INDEX ledger_entry_position ON ledger_entries(transaction_id, position)
WHERE position > 0;
CREATE FUNCTION fable_validate_entry_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE journal_xid xid8; account_currency text;
BEGIN
  SELECT posting_xid INTO journal_xid FROM ledger_transactions WHERE id = NEW.transaction_id;
  IF journal_xid IS DISTINCT FROM pg_current_xact_id() THEN
    RAISE EXCEPTION 'journal is sealed';
  END IF;
  SELECT currency INTO account_currency FROM ledger_accounts WHERE id = NEW.account_id FOR UPDATE;
  IF account_currency IS DISTINCT FROM NEW.currency THEN
    RAISE EXCEPTION 'account currency mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ledger_entry_insert_guard BEFORE INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION fable_validate_entry_insert();
CREATE TRIGGER ledger_accounts_immutable BEFORE UPDATE OR DELETE ON ledger_accounts
FOR EACH ROW EXECUTE FUNCTION fable_reject_mutation();
CREATE FUNCTION fable_wallet_nonnegative() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_type ledger_account_type; net numeric;
BEGIN
  SELECT type INTO account_type FROM ledger_accounts WHERE id = NEW.account_id;
  IF account_type = 'USER_WALLET' THEN
    SELECT COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount_minor ELSE -amount_minor END),0)
      INTO net FROM ledger_entries WHERE account_id = NEW.account_id;
    IF net < 0 THEN RAISE EXCEPTION 'insufficient wallet funds'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER wallet_funds_check AFTER INSERT ON ledger_entries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fable_wallet_nonnegative();
CREATE TABLE demo_bets (
  user_id uuid NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL,
  fingerprint text NOT NULL,
  record jsonb NOT NULL,
  placement_record jsonb NOT NULL,
  PRIMARY KEY(user_id, idempotency_key),
  CHECK (COALESCE(record->>'simulated' = 'true' AND record->>'realMoney' = 'false', false)),
  CHECK (COALESCE(record->>'status' IN ('accepted','settled','cancelled','refunded'), false))
);
CREATE FUNCTION fable_bet_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.fingerprint <> OLD.fingerprint THEN
    RAISE EXCEPTION 'bet identity is immutable';
  END IF;
  IF NEW.placement_record IS DISTINCT FROM OLD.placement_record THEN RAISE EXCEPTION 'placement response is immutable'; END IF;
  IF (NEW.record - 'status') IS DISTINCT FROM (OLD.record - 'status') THEN RAISE EXCEPTION 'accepted terms are immutable'; END IF;
  IF NEW.record->>'status' IS DISTINCT FROM OLD.record->>'status' AND NOT (
    (OLD.record->>'status'='accepted' AND NEW.record->>'status' IN ('settled','cancelled')) OR
    (OLD.record->>'status'='settled' AND NEW.record->>'status'='refunded')) THEN
    RAISE EXCEPTION 'invalid bet transition';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER demo_bet_transition BEFORE UPDATE ON demo_bets FOR EACH ROW EXECUTE FUNCTION fable_bet_transition();
CREATE TRIGGER demo_bet_delete BEFORE DELETE ON demo_bets FOR EACH ROW EXECUTE FUNCTION fable_reject_mutation();
CREATE TRIGGER ledger_entries_no_truncate BEFORE TRUNCATE ON ledger_entries FOR EACH STATEMENT EXECUTE FUNCTION fable_reject_mutation();
CREATE TRIGGER ledger_transactions_no_truncate BEFORE TRUNCATE ON ledger_transactions FOR EACH STATEMENT EXECUTE FUNCTION fable_reject_mutation();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION fable_reject_mutation();

COMMIT;
