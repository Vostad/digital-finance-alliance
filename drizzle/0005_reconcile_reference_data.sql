-- ============================================================================
-- RECONCILE REFERENCE DATA TO THE AUTHORITATIVE SPEC (FR-OS-SPEC.md §4, §14).
--
-- The stages and loss reasons seeded in 0002 were derived from the Gate 1
-- summary and do not match the approved lists. See FR-OS-SPEC.md §R for the
-- full divergence table. In short:
--
--   SPONSOR    `verbal` -> `meeting`, and `meeting` sits after `qualified`
--   DELEGATE   entirely different terminal states
--   SPEAKER    `new` -> `research`, `cancelled` -> `withdrawn`
--   CANCELLED  is a SPONSOR stage only (§46.3)
--
-- The probability ladder is unchanged: the eight approved sponsor values
-- 5/10/25/40/60/80/100/0 are preserved exactly and re-applied to the
-- authoritative stage names.
--
-- SAFE TO REPLACE OUTRIGHT because no opportunity references a stage key yet.
-- The guard below is not decoration: if this migration is ever replayed onto a
-- database with live pipeline data, deleting stage rows out from under it
-- would silently orphan every opportunity.
-- ============================================================================

DO $$
DECLARE
  live integer;
BEGIN
  SELECT count(*) INTO live FROM opportunities;
  IF live > 0 THEN
    RAISE EXCEPTION
      'Refusing to replace pipeline reference data: % opportunities already reference these stage keys. Migrate them explicitly first.',
      live;
  END IF;
END $$;--> statement-breakpoint

DELETE FROM "pipeline_stages";--> statement-breakpoint
DELETE FROM "loss_reasons";--> statement-breakpoint

INSERT INTO "pipeline_stages" ("function", "key", "label", "sort_order", "default_probability", "is_open", "is_won", "is_lost", "is_cancelled") VALUES
  -- SPONSOR (§11). The money pipeline. Probabilities are forecast weights.
  ('sponsor',  'new',         'New',          10,   5, true,  false, false, false),
  ('sponsor',  'contacted',   'Contacted',    20,  10, true,  false, false, false),
  ('sponsor',  'qualified',   'Qualified',    30,  25, true,  false, false, false),
  ('sponsor',  'meeting',     'Meeting',      40,  40, true,  false, false, false),
  ('sponsor',  'proposal',    'Proposal',     50,  60, true,  false, false, false),
  ('sponsor',  'negotiation', 'Negotiation',  60,  80, true,  false, false, false),
  ('sponsor',  'won',         'Won',          70, 100, false, true,  false, false),
  ('sponsor',  'lost',        'Lost',         80,   0, false, false, true,  false),
  -- §46.3 — reachable ONLY from WON, and only for sponsor.
  ('sponsor',  'cancelled',   'Cancelled',    90,   0, false, false, false, true),

  -- DELEGATE (§12). Counted, never priced. No CANCELLED stage.
  -- CONFIRMED and ATTENDED both count toward target: an opportunity sits in
  -- exactly one stage, so summing both cannot double count, and a delegate who
  -- attended was necessarily confirmed.
  ('delegate', 'new',         'New',          10,   5, true,  false, false, false),
  ('delegate', 'contacted',   'Contacted',    20,  15, true,  false, false, false),
  ('delegate', 'interested',  'Interested',   30,  35, true,  false, false, false),
  ('delegate', 'application', 'Application',  40,  60, true,  false, false, false),
  ('delegate', 'confirmed',   'Confirmed',    50, 100, false, true,  false, false),
  ('delegate', 'attended',    'Attended',     60, 100, false, true,  false, false),
  ('delegate', 'declined',    'Declined',     70,   0, false, false, true,  false),
  ('delegate', 'lost',        'Lost',         80,   0, false, false, true,  false),

  -- SPEAKER (§13). Count-based targets. RESEARCH is the entry state — a
  -- speaker is identified before anyone contacts them.
  ('speaker',  'research',    'Research',     10,   5, true,  false, false, false),
  ('speaker',  'contacted',   'Contacted',    20,  15, true,  false, false, false),
  ('speaker',  'interested',  'Interested',   30,  35, true,  false, false, false),
  ('speaker',  'invited',     'Invited',      40,  60, true,  false, false, false),
  ('speaker',  'confirmed',   'Confirmed',    50, 100, false, true,  false, false),
  ('speaker',  'declined',    'Declined',     60,   0, false, false, true,  false),
  ('speaker',  'withdrawn',   'Withdrawn',    70,   0, false, false, true,  false);--> statement-breakpoint

INSERT INTO "loss_reasons" ("function", "key", "label", "sort_order") VALUES
  ('sponsor',  'price',           'Price',            10),
  ('sponsor',  'timing',          'Timing',           20),
  ('sponsor',  'budget',          'Budget',           30),
  ('sponsor',  'wrong_audience',  'Wrong audience',   40),
  ('sponsor',  'competitor',      'Competitor',       50),
  ('sponsor',  'no_response',     'No response',      60),
  ('sponsor',  'not_interested',  'Not interested',   70),
  ('sponsor',  'other',           'Other',            99),

  ('delegate', 'not_interested',  'Not interested',   10),
  ('delegate', 'timing',          'Timing',           20),
  ('delegate', 'not_qualified',   'Not qualified',    30),
  ('delegate', 'no_response',     'No response',      40),
  ('delegate', 'other',           'Other',            99),

  ('speaker',  'declined',        'Declined',         10),
  ('speaker',  'timing',          'Timing',           20),
  ('speaker',  'not_available',   'Not available',    30),
  ('speaker',  'wrong_fit',       'Wrong fit',        40),
  ('speaker',  'no_response',     'No response',      50),
  ('speaker',  'other',           'Other',            99);--> statement-breakpoint

-- §46.3 — why a WON sponsor deal was undone. Never mixed with loss reasons.
INSERT INTO "cancellation_reasons" ("key", "label", "sort_order") VALUES
  ('deal_collapsed',   'Deal collapsed',   10),
  ('non_payment',      'Non-payment',      20),
  ('sponsor_withdrew', 'Sponsor withdrew', 30),
  ('event_change',     'Event change',     40),
  ('other',            'Other',            99)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

-- REQUIREMENT 1 — the new table joins the default-deny regime like every other.
ALTER TABLE "cancellation_reasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "cancellation_reasons" FROM anon, authenticated;--> statement-breakpoint

DO $$
DECLARE
  unprotected text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO unprotected
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false;
  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is not enabled on: %.', unprotected;
  END IF;
END $$;
