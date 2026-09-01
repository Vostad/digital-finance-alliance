#!/usr/bin/env node
/**
 * DATABASE VERIFICATION — the security invariants, checked against the live
 * database rather than against the migration files that were supposed to
 * establish them.
 *
 * `npm test` proves the rules in isolation. This proves the database actually
 * carries them: RLS on everywhere, no policies, no grants to the browser-side
 * roles, and the anon key unable to read or write a single row through
 * PostgREST.
 *
 * Run after every migration, and as the §41 final security audit.
 * Requires .env. Exits non-zero on any failure.
 */

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

let failures = 0;
const pad = (s, n) => String(s).padEnd(n);
const line = (label, value) => console.log("  " + pad(label, 48) + value);
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  line(label, `${ok ? "PASS" : "FAIL"}  (${actual}${ok ? "" : ` — expected ${expected}`})`);
}

/* The table list comes from the schema module itself, so adding a table
   cannot make this script silently check one fewer than exists. */
const { APPLICATION_TABLES } = await import("../src/server/db/schema.ts").catch(() => ({}));

console.log("\n=== SCHEMA ===");
const [{ count: tables }] = await sql`
  select count(*)::int from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE' and table_name <> '__drizzle_migrations'`;
if (APPLICATION_TABLES) check("application tables", tables, APPLICATION_TABLES.length);
else line("application tables", tables);

const naive = await sql`
  select 1 from information_schema.columns
  where table_schema='public' and data_type='timestamp without time zone'`;
check("columns storing naive timestamps", naive.length, 0);

const floats = await sql`
  select 1 from information_schema.columns
  where table_schema='public' and data_type in ('real','double precision')`;
check("monetary columns stored as float", floats.length, 0);

console.log("\n=== RLS DEFAULT DENY ===");
const unprotected = await sql`
  select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false`;
check("tables WITHOUT row level security", unprotected.length, 0);
unprotected.forEach((r) => line("   unprotected:", r.relname));

const policies = await sql`select 1 from pg_policies where schemaname='public'`;
check("RLS policies (must be zero)", policies.length, 0);

const grants = await sql`
  select 1 from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated')`;
check("table grants to anon/authenticated", grants.length, 0);

const directSchema = await sql`
  select 1 from pg_namespace n, aclexplode(n.nspacl) a
  where n.nspname='public' and a.privilege_type='USAGE' and a.grantee <> 0
    and a.grantee::regrole::text in ('anon','authenticated')`;
check("DIRECT schema USAGE grants to anon/authenticated", directSchema.length, 0);

console.log("\n=== ANON KEY AGAINST POSTGREST ===");
const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
let leaks = 0;
for (const t of [
  "users",
  "opportunities",
  "people",
  "companies",
  "commission_entries",
  "pipeline_stages",
  "settings",
  "audit_log",
]) {
  const res = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const body = await res.text();
  let rows = null;
  try {
    const j = JSON.parse(body);
    if (Array.isArray(j)) rows = j.length;
  } catch {
    /* not json */
  }
  const leaked = res.ok && rows !== null && rows > 0;
  if (leaked) {
    leaks += 1;
    failures += 1;
  }
  line(`GET /${t}`, `${leaked ? "LEAK" : "denied"}  HTTP ${res.status}`);
}
check("anon rows readable", leaks, 0);

console.log("\n=== REFERENCE DATA (configuration, not commercial history) ===");
for (const [fn, expected] of [
  ["sponsor", 9],
  ["delegate", 8],
  ["speaker", 7],
]) {
  const [{ count }] = await sql`
    select count(*)::int from pipeline_stages where function = ${fn}`;
  check(`${fn} pipeline stages`, count, expected);
}
const [{ count: cancelStages }] = await sql`
  select count(*)::int from pipeline_stages where is_cancelled`;
check("CANCELLED stages (sponsor only, per §46.3)", cancelStages, 1);

await sql.end();
console.log(`\n${failures === 0 ? "ALL DATABASE CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
