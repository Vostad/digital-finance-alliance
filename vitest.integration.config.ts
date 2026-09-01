import { defineConfig } from "vitest/config";

/**
 * THE INTEGRATION SUITE — runs against the real database.
 *
 * Separate from `npm test` on purpose. The unit suite must stay runnable with
 * no credentials, on any machine, in CI; this one needs .env and a migrated
 * Supabase project, and it is the only place a real connection is opened.
 *
 * Every test here runs inside a transaction that is rolled back. Nothing it
 * inserts is ever committed, so the database is left exactly as it was found —
 * which is what lets an authorization proof use realistic fixtures without
 * seeding commercial data that would later be mistaken for real.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/server/test/integration/**/*.test.ts"],
    setupFiles: ["src/server/test/integration/setup.ts"],
    /* One connection, one transaction at a time. */
    fileParallelism: false,
    /* These talk to a remote Supabase over the pooler. A fixture that opens
       twenty workstreams is sixty-odd round trips before the first assertion
       runs, and a tight timeout fails the suite for latency rather than for a
       defect. */
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
