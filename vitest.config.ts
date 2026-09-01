import { defineConfig } from "vitest/config";

/**
 * The Gate 2 permission suite runs with NO DATABASE and NO NETWORK.
 *
 * That is the point of it: the rules in permissions.ts are pure functions and
 * the structural checks read files, so the guarantees are provable on any
 * machine, in CI, before a single credential exists.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/server/test/**/*.test.ts"],
    /* The integration suite needs .env and a migrated database. It has its own
       config (vitest.integration.config.ts) and is run by `npm run test:integration`.
       Keeping it out of here is what preserves this suite's one guarantee:
       it runs anywhere, with no credentials. */
    exclude: ["src/server/test/integration/**"],
    env: {
      /** Shape-valid and unreachable. Nothing here opens a socket: postgres.js
          connects lazily and these tests only ever build SQL, never run it. */
      DATABASE_URL: "postgres://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
      DIRECT_DATABASE_URL: "postgres://u:p@db.example.supabase.co:5432/postgres",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
  },
});
