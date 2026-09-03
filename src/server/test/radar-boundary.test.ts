/**
 * RAILS RADAR — THE BOUNDARY, CHECKED STRUCTURALLY.
 *
 * The same discipline drizzle/0001 and rls-coverage.test.ts apply to the CRM,
 * applied to Radar: the guarantees are asserted against the executable SQL and
 * the lint config, on any machine, with no database and no credentials.
 *
 * What this suite is really protecting is the difference between "Radar is
 * public" and "Radar's PUBLISHED ROWS are public". Those are one WHERE clause
 * apart, and the clause lives in several places that must not drift.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(join(root, "drizzle/0013_rails_radar.sql"), "utf8");
const schema = readFileSync(join(root, "src/server/db/radar.ts"), "utf8");
const publicModule = readFileSync(join(root, "src/server/radar/public.ts"), "utf8");
const eslintConfig = readFileSync(join(root, "eslint.config.js"), "utf8");

/** The migration explains itself at length, and those comments quote the very
    statements the checks below forbid. Assert against executable SQL only. */
const executable = (sql: string) =>
  sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const sql = executable(migration);

const BASE_TABLES = [
  "radar_rails",
  "radar_providers",
  "radar_provider_markets",
  "radar_provider_assets",
  "radar_provider_networks",
  "radar_provider_use_cases",
  "radar_provider_requirements",
  "radar_licences",
  "radar_corridors",
  "radar_corridor_events",
  "radar_routes",
  "radar_route_assets",
  "radar_route_networks",
  "radar_route_requirements",
  "radar_submissions",
];

describe("radar lives in its own schema, not in public", () => {
  it("creates the schema", () => {
    expect(sql).toMatch(/CREATE SCHEMA IF NOT EXISTS "radar"/);
  });

  it("declares every table inside it, so no CRM join can be written by accident", () => {
    for (const t of BASE_TABLES) {
      expect(sql).toContain(`CREATE TABLE "radar"."${t}"`);
    }
  });

  it("never creates a radar table in public, which 0003 asserts anon cannot reach", () => {
    expect(sql).not.toMatch(/CREATE TABLE "public"\."radar_/);
    expect(schema).not.toMatch(/\bpgTable\(/);
    expect(schema).toContain('pgSchema("radar")');
  });
});

describe("RLS is on, everywhere, with no policies — the CRM's design, kept", () => {
  it.each(BASE_TABLES)("%s has RLS enabled", (table) => {
    expect(sql).toMatch(
      new RegExp(`ALTER TABLE "radar"\\."${table}"\\s+ENABLE ROW LEVEL SECURITY`),
    );
  });

  it("creates NO policies", () => {
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it("does not FORCE row level security, which would lock the app out of its own tables", () => {
    expect(sql).not.toMatch(/FORCE ROW LEVEL SECURITY/i);
  });

  it("leaves the whole-repo no-policy guarantee intact", () => {
    const all = readdirSync(join(root, "drizzle"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => executable(readFileSync(join(root, "drizzle", f), "utf8")))
      .join("\n");
    expect(all).not.toMatch(/CREATE POLICY/i);
  });
});

describe("the public grant reaches views only, never a base table", () => {
  it("revokes everything on base tables, now and for tables added later", () => {
    expect(sql).toMatch(/REVOKE ALL ON ALL TABLES IN SCHEMA "radar" FROM anon, authenticated/);
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA "radar" REVOKE ALL ON TABLES FROM anon, authenticated/,
    );
  });

  it("grants SELECT only on v_ views", () => {
    const grant = sql.match(/GRANT SELECT ON([\s\S]*?)TO anon, authenticated;/);
    expect(grant).not.toBeNull();
    const granted = [...grant![1]!.matchAll(/"radar"\."([a-z_]+)"/g)].map((m) => m[1]!);
    expect(granted.length).toBeGreaterThan(0);
    for (const name of granted) expect(name.startsWith("v_")).toBe(true);
  });

  it("never grants anything on the submissions table — it is unverified public input", () => {
    const grant = sql.match(/GRANT SELECT ON([\s\S]*?)TO anon, authenticated;/);
    expect(grant![1]).not.toContain("radar_submissions");
    expect(sql).not.toMatch(/GRANT[^;]*radar_submissions/);
  });

  it("builds no view over submissions at all", () => {
    expect(sql).not.toMatch(/CREATE VIEW[^;]*radar_submissions/);
  });

  it("asserts its own outcome in SQL, so the guarantee is verified by Postgres", () => {
    expect(sql).toContain("RAISE EXCEPTION");
    expect(sql).toContain("pg_policies");
  });
});

describe("every public view filters to published rows", () => {
  const views = [...sql.matchAll(/CREATE VIEW "radar"\."(v_[a-z_]+)" AS([\s\S]*?);--/g)];

  it("finds the views", () => {
    expect(views.length).toBeGreaterThanOrEqual(10);
  });

  it.each(views.map((m) => [m[1]!, m[2]!]))(
    "%s cannot return an unpublished row",
    (_name, body) => {
      /* Either it filters on status itself, or it joins a view that already
         has — v_route_assets and its siblings take the second route. */
      const filtersDirectly = /status = 'published'/.test(body);
      const inheritsFromView = /JOIN "radar"\."v_/.test(body);
      expect(filtersDirectly || inheritsFromView).toBe(true);
    },
  );

  it("v_routes requires the whole chain published, not just the route", () => {
    const body = sql.match(/CREATE VIEW "radar"\."v_routes" AS([\s\S]*?);--/)![1]!;
    expect(body).toMatch(/r\.status = 'published'/);
    expect(body).toMatch(/c\.status = 'published'/);
    expect(body).toMatch(/p\.status = 'published'/);
    expect(body).toMatch(/l\.status = 'published'/);
  });
});

describe("provenance is unstorable without a source", () => {
  it("every sourced value carries a CHECK tying it to a source URL", () => {
    for (const c of [
      "radar_providers_settlement_time_sourced",
      "radar_providers_settlement_hours_sourced",
      "radar_providers_settlement_fee_sourced",
      "radar_providers_limits_sourced",
      "radar_routes_limit_min_sourced",
      "radar_routes_limit_max_sourced",
      "radar_routes_finality_sourced",
      "radar_routes_hours_sourced",
      "radar_routes_cut_off_sourced",
      "radar_corridors_constraints_sourced",
    ]) {
      expect(sql).toContain(c);
    }
  });

  it("a licence cannot exist without the register it appears on", () => {
    expect(sql).toMatch(/"register_url" text NOT NULL/);
    expect(sql).toContain("radar_licences_register_url_present");
  });

  it("a limit cannot exist without the currency it is denominated in", () => {
    expect(sql).toContain("radar_routes_limit_currency_present");
  });
});

describe("no array columns — the pooler runs with fetch_types disabled", () => {
  it("declares none, so postgres.js never needs the catalog round trip that hangs", () => {
    /* An array column would reintroduce the type introspection that
       src/server/db/client.ts disables, and the symptom is a request that
       hangs rather than errors. Multi-value fields are child tables instead. */
    expect(sql).not.toMatch(/"[a-z_]+" (text|uuid|numeric)\[\]/);
  });
});

describe("the read module is fenced, and the fence is a regex not a glob", () => {
  it("uses regex patterns, which match ../ imports as well as aliased ones", () => {
    expect(eslintConfig).toContain('regex: "(^|/)db/schema$"');
    expect(eslintConfig).toContain('files: ["src/server/radar/*.ts"]');
  });

  it("the read module never names a CRM table", () => {
    expect(publicModule).not.toMatch(/from "\.\.\/db\/schema"/);
    expect(publicModule).toMatch(/from "\.\.\/db\/radar"/);
  });

  it("the read module contains no write path", () => {
    for (const write of [".insert(", ".update(", ".delete("]) {
      expect(publicModule).not.toContain(write);
    }
  });

  it("its published filter is a module constant, never a parameter", () => {
    expect(publicModule).toContain('const PUBLISHED = "published" as const');
    /* No exported function may take a status argument — that is how a caller
       would widen the scope this module exists to hold narrow. */
    expect(publicModule).not.toMatch(/export async function \w+\([^)]*status[^)]*\)/);
  });
});
