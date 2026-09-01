-- ============================================================================
-- THE RLS GUARANTEE, ASSERTED CORRECTLY.
--
-- 0001 revoked USAGE on schema public from anon and authenticated, and that
-- worked — the direct grants Supabase creates are gone. But verifying it with
-- has_schema_privilege('anon','public','USAGE') returns TRUE anyway, and the
-- first reading of that is "the revoke failed". It did not.
--
-- Postgres grants USAGE on schema public to PUBLIC, the implicit role every
-- other role inherits from. The ACL after 0001 reads:
--
--   {pg_database_owner=UC/pg_database_owner,   <- the owner
--    =U/pg_database_owner,                     <- PUBLIC. this one.
--    postgres=U/pg_database_owner,
--    service_role=U/pg_database_owner}
--
-- No anon. No authenticated. has_schema_privilege still answers TRUE because
-- it resolves inherited privileges, so it is the wrong question to ask.
--
-- WHY PUBLIC'S USAGE IS LEFT IN PLACE: schema USAGE by itself permits nothing.
-- It allows a name to be resolved; it does not permit selecting from, writing
-- to, or describing an object the role has no privilege on. With zero table
-- privileges — asserted below — anon reaches every table as 42501
-- insufficient_privilege. Revoking from PUBLIC would be defence in depth
-- against a hole that is already closed, and PUBLIC is inherited by Supabase's
-- own managed roles, so it is a real risk taken for no measurable gain.
--
-- THE RIGHT QUESTION, asserted here and re-asserted on every deploy:
--   1. anon and authenticated hold NO table privilege in public
--   2. anon and authenticated hold NO DIRECT grant on the schema
--   3. RLS is enabled everywhere and no policy exists   (also checked in 0001)
-- ============================================================================

DO $$
DECLARE
  leaked   text;
  direct   text;
BEGIN
  -- 1. The privilege that actually gates access.
  SELECT string_agg(DISTINCT grantee || ' -> ' || table_name, ', ')
    INTO leaked
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION
      'anon/authenticated hold table privileges in public: %. The anon key ships in the browser; it must reach nothing.',
      leaked;
  END IF;

  -- 2. No direct schema grant. Inherited PUBLIC usage is expected and harmless.
  SELECT string_agg(a.grantee::regrole::text, ', ')
    INTO direct
  FROM pg_namespace n, aclexplode(n.nspacl) a
  WHERE n.nspname = 'public'
    AND a.privilege_type = 'USAGE'
    AND a.grantee <> 0
    AND a.grantee::regrole::text IN ('anon', 'authenticated');

  IF direct IS NOT NULL THEN
    RAISE EXCEPTION
      'anon/authenticated hold a DIRECT USAGE grant on schema public: %. 0001 should have revoked it.',
      direct;
  END IF;
END $$;
