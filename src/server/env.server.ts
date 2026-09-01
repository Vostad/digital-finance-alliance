/**
 * Server-only environment access for FINANCIAL RAILS OS.
 *
 * NOTHING here is VITE_-prefixed, so nothing here can be inlined into a client
 * bundle by Vite. The `.server.ts` suffix is the second guard: importing this
 * module from client code is a build error, and eslint blocks it besides.
 *
 * Read once, validated once, at first use — not at module load, so that a
 * missing variable produces a clear runtime error on the request that needed
 * it rather than a blank white page at boot.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example for the full list.`,
    );
  }
  return value;
}

/**
 * REQUIREMENT 6 — the pooled connection string, enforced rather than trusted.
 *
 * Vercel functions are short-lived and numerous; the direct connection has a
 * hard connection ceiling that a traffic spike will exhaust, and the failure
 * mode is "the whole admin system is down", not "one request is slow". A typo
 * here is silent until the day it matters, so we refuse to start on it.
 *
 * Supabase pooled hosts are `*.pooler.supabase.com`; transaction mode is 6543.
 * The direct host is `db.<ref>.supabase.co:5432` and is correct ONLY for
 * drizzle-kit, which needs session-mode DDL — that path uses DIRECT_DATABASE_URL.
 */
function assertPooled(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection URL.");
  }
  if (!parsed.hostname.includes("pooler.supabase.com")) {
    throw new Error(
      `DATABASE_URL points at ${parsed.hostname}, which is not the Supabase pooler. ` +
        `Serverless functions must connect through *.pooler.supabase.com. ` +
        `Put the direct connection in DIRECT_DATABASE_URL instead — it is for migrations only.`,
    );
  }
  if (parsed.port !== "6543") {
    throw new Error(
      `DATABASE_URL uses port ${parsed.port || "(default)"}, not 6543. ` +
        `Use the TRANSACTION-mode pooler for runtime queries; session mode (5432) ` +
        `holds a backend per client and defeats the point of pooling under serverless.`,
    );
  }
  return url;
}

export const serverEnv = {
  get databaseUrl() {
    return assertPooled(required("DATABASE_URL"));
  },
  /** drizzle-kit only. Never imported by application code. */
  get directDatabaseUrl() {
    return required("DIRECT_DATABASE_URL");
  },
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("SUPABASE_ANON_KEY");
  },
  /**
   * REQUIREMENT 2 — server-only, forever. Bypasses RLS entirely and can mint
   * sessions for any user. Used for exactly two things: creating invited
   * accounts, and revoking them. `npm run check:client-bundle` fails the build
   * if this name or its value reaches client output.
   */
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
};
