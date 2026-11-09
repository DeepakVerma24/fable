BEGIN;
-- This is the final cutover boundary, including databases that already applied Phase 7.
-- Do not rewrite applied migrations. Drain old writers before running the full chain.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
LOCK TABLE public.ledger_transactions, public.ledger_entries, public.ledger_accounts,
  public.demo_bets, public.audit_log IN ACCESS EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS (SELECT t.id FROM public.ledger_transactions t LEFT JOIN public.ledger_entries e ON e.transaction_id=t.id
    GROUP BY t.id HAVING count(e.id)<2 OR count(DISTINCT e.currency)<>1 OR
    COALESCE(sum(CASE WHEN e.direction='DEBIT' THEN e.amount_minor ELSE -e.amount_minor END),0)<>0) THEN
    RAISE EXCEPTION 'historical journal imbalance requires reconciliation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_entries e JOIN public.ledger_accounts a ON a.id=e.account_id WHERE e.currency<>a.currency) THEN
    RAISE EXCEPTION 'historical account currency mismatch requires reconciliation';
  END IF;
  IF EXISTS (SELECT a.id FROM public.ledger_accounts a JOIN public.ledger_entries e ON e.account_id=a.id WHERE a.type='USER_WALLET'
    GROUP BY a.id HAVING sum(CASE WHEN e.direction='CREDIT' THEN e.amount_minor ELSE -e.amount_minor END)<0) THEN
    RAISE EXCEPTION 'historical negative wallet requires reconciliation';
  END IF;
END $$;

-- Concurrency metadata only: never a balance, projection, or financial authority.
-- An actual MVCC update makes stale REPEATABLE READ/SERIALIZABLE writers abort.
CREATE TABLE public.ledger_account_fences (
  account_id uuid PRIMARY KEY REFERENCES public.ledger_accounts(id),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
INSERT INTO public.ledger_account_fences(account_id) SELECT id FROM public.ledger_accounts;
REVOKE ALL ON public.ledger_account_fences FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- Runtime sessions must not redirect existing trigger reads to temporary tables.
ALTER FUNCTION public.fable_validate_entry_insert() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fable_wallet_nonnegative() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fable_assert_journal_balanced() SET search_path = pg_catalog, public, pg_temp;

CREATE FUNCTION public.fable_advance_account_fence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.ledger_account_fences(account_id, revision) VALUES (NEW.account_id, 1)
    ON CONFLICT (account_id) DO UPDATE SET revision = public.ledger_account_fences.revision + 1;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fable_advance_account_fence() FROM PUBLIC;
CREATE TRIGGER ledger_entry_account_fence BEFORE INSERT ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.fable_advance_account_fence();

-- Every inserted line schedules a new check, even after SET CONSTRAINTS flushed
-- the header's check. Retain the header check so empty journals also fail.
CREATE FUNCTION public.fable_assert_entry_journal_balanced() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE net numeric; currencies bigint; lines bigint;
BEGIN
  SELECT COALESCE(sum(CASE WHEN direction='DEBIT' THEN amount_minor ELSE -amount_minor END),0),
    count(DISTINCT currency), count(*) INTO net, currencies, lines
    FROM public.ledger_entries WHERE transaction_id=NEW.transaction_id;
  IF net<>0 OR currencies<>1 OR lines<2 THEN
    RAISE EXCEPTION 'ledger transaction % is not a balanced simulated journal', NEW.transaction_id;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ledger_entries_must_balance AFTER INSERT ON public.ledger_entries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.fable_assert_entry_journal_balanced();

-- Used by the new financial stores to fail closed on an incomplete deployment.
CREATE FUNCTION public.fable_require_financial_hardening() RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$ SELECT true $$;
COMMIT;
