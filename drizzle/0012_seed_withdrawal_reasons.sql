-- ============================================================================
-- D4 — WITHDRAWAL REASONS, in their own vocabulary.
--
-- 0010 put four `withdrew_*` rows into `loss_reasons` as a stopgap. That was
-- wrong for the same reason cancellations were never allowed to live there: one
-- careless `WHERE loss_reason_key IS NOT NULL` would count a withdrawal as a
-- loss, misreporting the loss rate and the attrition rate simultaneously.
--
-- They move to their own table, and the stopgap rows are removed.
-- ============================================================================

INSERT INTO "withdrawal_reasons" ("key", "label", "sort_order") VALUES
  ('schedule_changed',  'Schedule changed',         10),
  ('cannot_travel',     'Cannot travel',            20),
  ('internal_change',   'Internal change at firm',  30),
  ('event_change',      'Event changed',            40),
  ('no_longer_relevant','No longer relevant',       50),
  ('other',             'Other',                    99)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

-- Remove the stopgap. Guarded: if any opportunity is already using one of
-- these keys, deleting the reference row would orphan it.
DO $$
DECLARE inuse integer;
BEGIN
  SELECT count(*) INTO inuse FROM opportunities
  WHERE loss_reason_key LIKE 'withdrew\_%';
  IF inuse > 0 THEN
    RAISE EXCEPTION '% opportunities still reference a withdrew_* loss reason. Migrate them to withdrawal_reason_key first.', inuse;
  END IF;
END $$;--> statement-breakpoint

DELETE FROM "loss_reasons"
WHERE "function" = 'speaker' AND "key" LIKE 'withdrew\_%';--> statement-breakpoint

ALTER TABLE "withdrawal_reasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "withdrawal_reasons" FROM anon, authenticated;--> statement-breakpoint

DO $$
DECLARE unprotected text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO unprotected
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false;
  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is not enabled on: %.', unprotected;
  END IF;
END $$;
