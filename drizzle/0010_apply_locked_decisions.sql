-- ============================================================================
-- LOCKED DECISIONS D2, D4, D5 — applied to reference data.
--
-- D2 · DELEGATE ACHIEVEMENT IS CONFIRMED, NOT ATTENDED.
--      ATTENDED stops being `is_won` and becomes `is_attendance`. The
--      conversion already happened at CONFIRMED and stamped `won_at`;
--      achievement reads that timestamp, so moving CONFIRMED -> ATTENDED
--      preserves the one achievement rather than adding a second or losing it.
--
-- D4 · SPEAKER WITHDRAWN IS ATTRITION, NOT LOSS.
--      DECLINED is a loss — they never confirmed. WITHDRAWN is attrition —
--      they confirmed and then left. Aggregating them would misreport the loss
--      rate and the conversion rate at the same time.
--
-- D5 · THE PUBLIC INTAKE MAPPING IS EXPLICIT.
--      /forums/mena resolves to MENA 2026 by key, never by "whichever edition
--      happens to be active".
--
-- Safe to apply: the database holds zero opportunities. Guarded anyway, because
-- flipping is_won on a stage that live rows sit in would silently rewrite
-- every target number in the system.
-- ============================================================================

DO $$
DECLARE live integer;
BEGIN
  SELECT count(*) INTO live FROM opportunities
  WHERE stage_key IN ('attended', 'withdrawn');
  IF live > 0 THEN
    RAISE EXCEPTION
      'Refusing to change outcome flags: % opportunities currently sit at attended/withdrawn and their achievement would change silently.',
      live;
  END IF;
END $$;--> statement-breakpoint

-- D2 — ATTENDED: fulfilment, not a second conversion.
UPDATE "pipeline_stages"
SET "is_won" = false, "is_attendance" = true, "default_probability" = 100
WHERE "function" = 'delegate' AND "key" = 'attended';--> statement-breakpoint

-- D4 — WITHDRAWN: attrition, not a loss.
UPDATE "pipeline_stages"
SET "is_lost" = false, "is_attrition" = true
WHERE "function" = 'speaker' AND "key" = 'withdrawn';--> statement-breakpoint

-- D4 — a withdrawal takes a withdrawal reason, not a loss reason.
INSERT INTO "loss_reasons" ("function", "key", "label", "sort_order") VALUES
  ('speaker', 'withdrew_schedule',  'Schedule changed',        110),
  ('speaker', 'withdrew_travel',    'Cannot travel',           120),
  ('speaker', 'withdrew_internal',  'Internal change at firm', 130),
  ('speaker', 'withdrew_other',     'Other',                   199)
ON CONFLICT ("function", "key") DO NOTHING;--> statement-breakpoint

-- D5 — the one explicit mapping that exists today.
UPDATE "editions" SET "public_intake_key" = 'mena'
WHERE "slug" = '2026'
  AND "event_id" = (SELECT id FROM "events" WHERE slug = 'mena');--> statement-breakpoint

DO $$
DECLARE
  mapped integer;
  bad    integer;
BEGIN
  SELECT count(*) INTO mapped FROM editions WHERE public_intake_key = 'mena';
  IF mapped <> 1 THEN
    RAISE EXCEPTION 'The public intake key "mena" must resolve to exactly one edition; it resolves to %.', mapped;
  END IF;

  -- The invariants D2 and D4 turn on. Asserted here so a later edit that
  -- reverts them fails the migration rather than quietly changing every number.
  SELECT count(*) INTO bad FROM pipeline_stages
  WHERE (function = 'delegate' AND key = 'attended'  AND (is_won OR NOT is_attendance))
     OR (function = 'speaker'  AND key = 'withdrawn' AND (is_lost OR NOT is_attrition));
  IF bad > 0 THEN
    RAISE EXCEPTION 'D2/D4 outcome flags are not as specified on % stage(s).', bad;
  END IF;
END $$;
