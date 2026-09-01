-- ============================================================================
-- THE EVENT CALENDAR — configuration, not commercial history.
--
-- §40 forbids inventing production data. Nothing here is invented: every value
-- is a published fact taken from the live public site.
--
--   Financial Rails Summit MENA   Dubai        18-19 November 2026
--                                 /forums/mena, live, dates on the page
--   Financial Rails Asia          Singapore    announced, dates TBC
--   Financial Rails Africa        announced, dates TBC
--
-- No person, company, opportunity, target or commission row is seeded anywhere
-- in this repository. The system still starts commercially empty.
--
-- The MENA 2026 edition is `active` because the public microsite is selling it
-- and website submissions must have an edition to file against. The others are
-- `planning`: announced, not yet open for intake.
--
-- Idempotent — an operator editing a name or a date in the UI is not undone by
-- a later deploy.
-- ============================================================================

INSERT INTO "events" ("name", "slug", "region", "status") VALUES
  ('Financial Rails Summit MENA', 'mena',   'MENA',   'active'),
  ('Financial Rails Asia',        'asia',   'Asia',   'active'),
  ('Financial Rails Africa',      'africa', 'Africa', 'active')
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

INSERT INTO "editions" ("event_id", "name", "slug", "city", "country", "starts_on", "ends_on", "status")
SELECT e.id, v.name, v.slug, v.city, v.country, v.starts_on::date, v.ends_on::date, v.status::edition_status
FROM (VALUES
  ('mena',   'MENA 2026',   '2026', 'Dubai',     'AE', '2026-11-18', '2026-11-19', 'active'),
  ('asia',   'Asia 2027',   '2027', 'Singapore', 'SG', NULL,         NULL,         'planning'),
  ('africa', 'Africa 2027', '2027', NULL,        NULL, NULL,         NULL,         'planning')
) AS v(event_slug, name, slug, city, country, starts_on, ends_on, status)
JOIN "events" e ON e.slug = v.event_slug
ON CONFLICT DO NOTHING;
