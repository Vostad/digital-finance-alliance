import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit OWNS THE SCHEMA. Requirement 5, decided: one migration tool.
 * The Supabase CLI is used for nothing that writes DDL — see docs/fr-os/migrations.md.
 *
 * Migrations run against DIRECT_DATABASE_URL, not the pooled runtime string:
 * DDL needs session-level state that the transaction pooler does not preserve.
 */
export default defineConfig({
  /**
   * Two products, one migration history. `radar.ts` declares the Rails Radar
   * tables, which live in their own `radar` Postgres schema — see the header of
   * that file for why they are not in `public`.
   */
  schema: ["./src/server/db/schema.ts", "./src/server/db/radar.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env["DIRECT_DATABASE_URL"] ?? "",
  },
  /** Supabase owns auth, storage, realtime, etc. Never diff or drop them.
      `radar` is ours and is managed here like `public`. */
  schemaFilter: ["public", "radar"],
  verbose: true,
  strict: true,
});
