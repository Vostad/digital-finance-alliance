-- ============================================================================
-- REFERENCE DATA — pipeline stages and loss reasons.
--
-- This is CONFIGURATION, not commercial history. No company, person,
-- opportunity, target or commission row is seeded anywhere in this repository:
-- the system starts commercially empty and every number it ever shows will
-- have been entered by someone.
--
-- Idempotent, so re-running the migration set on an existing database is safe.
-- `default_probability` is the one column an operator may later edit (§16);
-- ON CONFLICT DO NOTHING therefore leaves an edited value alone rather than
-- resetting it on the next deploy.
-- ============================================================================

INSERT INTO "pipeline_stages" ("function", "key", "label", "sort_order", "default_probability", "is_open", "is_won", "is_lost", "is_cancelled") VALUES
  -- SPONSOR — the money pipeline. Probabilities are the forecast weights.
  ('sponsor',  'new',          'New',           10,   5, true,  false, false, false),
  ('sponsor',  'contacted',    'Contacted',     20,  10, true,  false, false, false),
  ('sponsor',  'qualified',    'Qualified',     30,  25, true,  false, false, false),
  ('sponsor',  'proposal',     'Proposal sent', 40,  40, true,  false, false, false),
  ('sponsor',  'negotiation',  'Negotiation',   50,  60, true,  false, false, false),
  ('sponsor',  'verbal',       'Verbal yes',    60,  80, true,  false, false, false),
  ('sponsor',  'won',          'Won',           70, 100, false, true,  false, false),
  ('sponsor',  'lost',         'Lost',          80,   0, false, false, true,  false),
  -- §22 — CANCELLED is not LOST. A deal that was won and then fell through
  -- reverses commission; a deal that was never won never earned any.
  ('sponsor',  'cancelled',    'Cancelled',     90,   0, false, false, false, true),

  -- DELEGATE — counted in people, not money. Weights still drive the funnel view.
  ('delegate', 'new',          'New',           10,   5, true,  false, false, false),
  ('delegate', 'contacted',    'Contacted',     20,  15, true,  false, false, false),
  ('delegate', 'qualified',    'Qualified',     30,  35, true,  false, false, false),
  ('delegate', 'invited',      'Invited',       40,  60, true,  false, false, false),
  ('delegate', 'registered',   'Registered',    50, 100, false, true,  false, false),
  ('delegate', 'declined',     'Declined',      60,   0, false, false, true,  false),
  ('delegate', 'cancelled',    'Cancelled',     70,   0, false, false, false, true),

  -- SPEAKER — same shape; CONFIRMED is the won state.
  ('speaker',  'new',          'New',           10,   5, true,  false, false, false),
  ('speaker',  'contacted',    'Contacted',     20,  15, true,  false, false, false),
  ('speaker',  'qualified',    'Qualified',     30,  35, true,  false, false, false),
  ('speaker',  'invited',      'Invited',       40,  60, true,  false, false, false),
  ('speaker',  'confirmed',    'Confirmed',     50, 100, false, true,  false, false),
  ('speaker',  'declined',     'Declined',      60,   0, false, false, true,  false),
  ('speaker',  'cancelled',    'Cancelled',     70,   0, false, false, false, true)
ON CONFLICT ("function", "key") DO NOTHING;--> statement-breakpoint

INSERT INTO "loss_reasons" ("function", "key", "label", "sort_order") VALUES
  ('sponsor',  'budget',           'No budget this cycle',        10),
  ('sponsor',  'timing',           'Wrong timing',                20),
  ('sponsor',  'no_response',      'Went quiet',                  30),
  ('sponsor',  'competitor',       'Chose another event',         40),
  ('sponsor',  'not_a_fit',        'Not a fit',                   50),
  ('sponsor',  'internal_change',  'Internal change at the firm', 60),
  ('sponsor',  'other',            'Other',                       99),

  ('delegate', 'cannot_travel',    'Cannot travel',               10),
  ('delegate', 'timing',           'Wrong timing',                20),
  ('delegate', 'no_response',      'Went quiet',                  30),
  ('delegate', 'not_qualified',    'Does not qualify',            40),
  ('delegate', 'other',            'Other',                       99),

  ('speaker',  'unavailable',      'Unavailable on the dates',    10),
  ('speaker',  'cannot_travel',    'Cannot travel',               20),
  ('speaker',  'no_response',      'Went quiet',                  30),
  ('speaker',  'not_a_fit',        'Not a fit for the agenda',    40),
  ('speaker',  'other',            'Other',                       99)
ON CONFLICT ("function", "key") DO NOTHING;
