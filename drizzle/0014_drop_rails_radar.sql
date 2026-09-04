-- ============================================================================
-- REMOVE RAILS RADAR FROM THIS DATABASE.
--
-- Rails Radar is a separate company and is being rebuilt elsewhere. Nothing
-- here is migrated, exported or preserved.
--
-- ONE STATEMENT, ONE SCHEMA. Everything Radar created lives inside the `radar`
-- schema — 15 tables, 14 published-only views, 7 enum types, and the SELECT
-- grants that let `anon` read the views. Dropping the schema with CASCADE takes
-- all of it, including objects drizzle-kit cannot see: it generated DROP TABLE
-- and DROP TYPE from the schema files, but the views and grants were written by
-- hand in 0013 and are invisible to it.
--
-- WHY THIS CANNOT REACH THE CRM. Every application table lives in `public`, and
-- `public` is not named below. CASCADE follows dependencies, and there are none
-- crossing the boundary: no table in `public` references a radar object, and no
-- radar object was ever referenced from `public` — the two graphs were disjoint
-- by construction, which is the reason Radar was given its own schema in 0013.
--
-- The assertion at the end proves that claim against the database rather than
-- asserting it in a comment: it counts what survives in `public` and fails the
-- migration if a single relation went missing.
-- ============================================================================

DO $$
DECLARE
  public_before int;
  public_after  int;
  radar_left    int;
BEGIN
  SELECT count(*) INTO public_before
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v');

  DROP SCHEMA IF EXISTS "radar" CASCADE;

  SELECT count(*) INTO public_after
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v');

  IF public_after <> public_before THEN
    RAISE EXCEPTION
      'Dropping the radar schema changed the public schema: % relations before, % after. Rolling back.',
      public_before, public_after;
  END IF;

  SELECT count(*) INTO radar_left FROM pg_namespace WHERE nspname = 'radar';
  IF radar_left <> 0 THEN
    RAISE EXCEPTION 'The radar schema still exists after the drop.';
  END IF;

  RAISE NOTICE 'radar schema dropped; public untouched at % relations.', public_after;
END $$;
