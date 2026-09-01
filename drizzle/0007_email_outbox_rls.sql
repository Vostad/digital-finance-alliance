-- The outbox joins the default-deny regime like every other table. It holds
-- names, email addresses and message bodies; the anon key must not reach it.
ALTER TABLE "email_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "email_outbox" FROM anon, authenticated;--> statement-breakpoint

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
