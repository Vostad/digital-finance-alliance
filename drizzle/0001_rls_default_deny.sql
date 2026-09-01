-- ============================================================================
-- REQUIREMENT 1 — RLS ON, DEFAULT DENY, EVERY TABLE.
--                 THE ANON KEY MUST BE ABLE TO READ NOTHING.
--
-- Read this before changing anything below.
--
-- A Supabase project exposes every table in `public` through PostgREST at
-- https://<ref>.supabase.co/rest/v1/, reachable by anyone holding the anon key
-- — which ships in the browser and is therefore public. That surface is not
-- optional and cannot be turned off per table. RLS is what closes it.
--
-- The rule here is deny-by-omission: RLS is enabled on all 23 application
-- tables and NOT ONE POLICY IS CREATED. With RLS enabled and no policy, every
-- SELECT, INSERT, UPDATE and DELETE by a non-owner role returns zero rows or
-- errors. There is no permissive default to forget to override.
--
-- WHY THE APPLICATION STILL WORKS: the app connects over the pooler as the
-- table owner (`postgres`), and an owner is exempt from its own RLS. That is
-- deliberate and it is the honest description of the security model:
--
--   RLS               closes the PostgREST/anon surface. Backstop.
--   scopedQuery(ctx)  enforces who-sees-what for the application. Primary.
--
-- Do not read the policies below as the app's authorization model, because
-- there are none. The model is in src/server/auth/permissions.ts, it is tested,
-- and §37 is satisfied by it — server-side, on every write, never by UI.
--
-- FORCE ROW LEVEL SECURITY is deliberately NOT used: it would subject the
-- owner to these (nonexistent) policies and take the application offline.
-- ============================================================================

-- 1. Enable RLS on every application table. No policies follow. That is the point.
ALTER TABLE "users"                 ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_functions"        ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_event_scopes"     ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations"           ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events"                ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "editions"              ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies"             ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_domains"       ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "people"                ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "person_emails"         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pipeline_stages"       ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loss_reasons"          ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "opportunities"         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activities"            ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "form_submissions"      ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "targets"               ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commission_rules"      ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commission_rule_tiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commission_entries"    ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log"             ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "merges"                ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "erasures"              ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings"              ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- 2. Belt as well as braces. RLS filters rows; these revokes remove the table
--    privilege outright, so `anon` cannot so much as learn a table's shape.
--    Supabase grants these by default on schema creation — undo that.
REVOKE ALL ON ALL TABLES    IN SCHEMA "public" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM anon, authenticated;--> statement-breakpoint
REVOKE USAGE ON SCHEMA "public" FROM anon, authenticated;--> statement-breakpoint

-- 3. And for every table added after today. Without this, table 24 arrives
--    with Supabase's default grants and the hole reopens silently.
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES    FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM anon, authenticated;--> statement-breakpoint

-- 4. The self-check. Fails the migration if any application table is missing
--    RLS or has acquired a permissive policy — so the guarantee is verified by
--    the database itself rather than by whoever last remembered to look.
DO $$
DECLARE
  unprotected text;
  policied    text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO unprotected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false;

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is not enabled on: %. Every table in public must be default-deny.', unprotected;
  END IF;

  SELECT string_agg(DISTINCT tablename, ', ') INTO policied
  FROM pg_policies WHERE schemaname = 'public';

  IF policied IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected RLS policies on: %. This system is default-deny with zero policies; authorization lives in scopedQuery(ctx).', policied;
  END IF;
END $$;
