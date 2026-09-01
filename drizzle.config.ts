import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit OWNS THE SCHEMA. Requirement 5, decided: one migration tool.
 * The Supabase CLI is used for nothing that writes DDL — see docs/fr-os/migrations.md.
 *
 * Migrations run against DIRECT_DATABASE_URL, not the pooled runtime string:
 * DDL needs session-level state that the transaction pooler does not preserve.
 */
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env["DIRECT_DATABASE_URL"] ?? "",
  },
  /** Supabase owns auth, storage, realtime, etc. Never diff or drop them. */
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
