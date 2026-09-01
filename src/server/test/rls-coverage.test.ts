/**
 * REQUIREMENT 1, CHECKED STRUCTURALLY.
 *
 * The database enforces default-deny at migration time (0001 raises if any
 * table is unprotected). This suite catches the same mistake one step earlier —
 * the moment a 24th table is added to schema.ts and not to the RLS migration,
 * before anyone runs anything against a real database.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { APPLICATION_TABLES } from "../db/schema";

const root = process.cwd();
const schemaSource = readFileSync(join(root, "src/server/db/schema.ts"), "utf8");
const rlsSource = readFileSync(join(root, "drizzle/0001_rls_default_deny.sql"), "utf8");
const initialSource = readFileSync(join(root, "drizzle/0000_initial_schema.sql"), "utf8");

/** Both migrations explain themselves at length, and those comments quote the
    very statements the checks below forbid. Assert against executable SQL only. */
const stripComments = (sql: string) =>
  sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const rlsStatements = stripComments(rlsSource);
const initialStatements = stripComments(initialSource);

/** Every `pgTable("x", …)` in the schema. `auth.users` is declared through
    `authSchema.table(…)` and is correctly excluded — Supabase owns it. */
const declaredTables = [...schemaSource.matchAll(/pgTable\(\s*"([a-z_]+)"/g)].map((m) => m[1]!);

describe("every table is accounted for", () => {
  it("APPLICATION_TABLES matches what schema.ts actually declares", () => {
    expect([...declaredTables].sort()).toEqual([...APPLICATION_TABLES].sort());
  });

  it("declares the 23 application tables (auth.users is Supabase's, not ours)", () => {
    expect(declaredTables).toHaveLength(23);
    expect(declaredTables).not.toContain("auth");
  });
});

describe("RLS is on, everywhere, with nothing switched back on", () => {
  it.each([...APPLICATION_TABLES])("%s has RLS enabled", (table) => {
    const pattern = new RegExp(`ALTER TABLE "${table}"\\s+ENABLE ROW LEVEL SECURITY`);
    expect(rlsSource).toMatch(pattern);
  });

  it("creates NO policies — deny by omission is the whole design", () => {
    expect(rlsStatements).not.toMatch(/CREATE POLICY/i);
    expect(initialStatements).not.toMatch(/CREATE POLICY/i);
  });

  it("does not FORCE row level security, which would lock the app out too", () => {
    expect(rlsStatements).not.toMatch(/FORCE ROW LEVEL SECURITY/i);
  });

  it("revokes the anon and authenticated grants Supabase adds by default", () => {
    expect(rlsSource).toMatch(
      /REVOKE ALL ON ALL TABLES\s+IN SCHEMA "public" FROM anon, authenticated/,
    );
    expect(rlsSource).toMatch(/REVOKE USAGE ON SCHEMA "public" FROM anon, authenticated/);
  });

  it("revokes them for future tables too, so table 24 cannot arrive open", () => {
    expect(rlsSource).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES\s+FROM anon, authenticated/,
    );
  });

  it("asserts its own outcome, so the guarantee is verified by Postgres", () => {
    expect(rlsSource).toContain("relrowsecurity = false");
    expect(rlsSource).toContain("RAISE EXCEPTION");
  });
});

describe("the initial migration leaves Supabase's own tables alone", () => {
  it("does not create auth.users", () => {
    expect(initialStatements).not.toMatch(/CREATE TABLE "auth"\."users"/);
  });

  it("still declares the foreign key onto it", () => {
    expect(initialSource).toMatch(/FOREIGN KEY \("id"\) REFERENCES "auth"\."users"\("id"\)/);
  });

  it("fails loudly if pointed at a database that is not a Supabase project", () => {
    expect(initialSource).toContain("to_regclass('auth.users') IS NULL");
  });
});

describe("Gate 2 schema additions", () => {
  it("commission_entries.reverses_entry_id exists as a self-referencing FK", () => {
    expect(initialSource).toMatch(/"reverses_entry_id" uuid/);
    expect(initialSource).toMatch(
      /"commission_entries_reverses_fk" FOREIGN KEY \("reverses_entry_id"\) REFERENCES "public"\."commission_entries"\("id"\)/,
    );
  });

  it("only a reversal may name the entry it reverses", () => {
    expect(initialSource).toContain("commission_entries_reversal_link");
  });

  it("every monetary column carries a currency, and money is numeric not float", () => {
    expect(initialStatements).not.toMatch(
      /"(estimated|final|base|fixed|target|min|max)_(value|amount)" (real|double)/,
    );
    expect(initialSource).toMatch(/"final_value" numeric\(14, 2\)/);
    expect(initialSource).toMatch(/"currency" char\(3\)/);
  });

  it("every timestamp is stored with a time zone", () => {
    const naive = initialStatements.match(/"[a-z_]+" timestamp(?! with time zone)/g);
    expect(naive).toBeNull();
  });
});
