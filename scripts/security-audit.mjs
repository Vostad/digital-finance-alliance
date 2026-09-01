#!/usr/bin/env node
/**
 * §41 — THE FINAL SECURITY AUDIT.
 *
 * Everything the spec names, checked against the LIVE project and the BUILT
 * output rather than against the source that was supposed to produce them.
 *
 * `npm test` proves the rules in isolation and `npm run test:integration`
 * proves them against Postgres. This proves the deployment: that RLS is on,
 * that the anon key reaches nothing, that no secret is in the browser bundle,
 * and that the authorization boundary the whole system rests on is still
 * enforced by tooling rather than by memory.
 *
 * Exits non-zero on any failure.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

let failures = 0;
const pad = (s, n) => String(s).padEnd(n);
const line = (label, value) => console.log("  " + pad(label, 52) + value);
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  line(label, `${ok ? "PASS" : "FAIL"}  (${actual}${ok ? "" : ` — expected ${expected}`})`);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, fetch_types: false, max: 2 });

console.log("\n═══ 1 · AUTHENTICATION ═══");
{
  /* Every route under /admin except the login page must resolve a session. */
  const routes = readdirSync("src/routes").filter(
    (f) => f.startsWith("admin.") && f.endsWith(".tsx"),
  );
  const unguarded = routes.filter((f) => {
    if (f === "admin.login.tsx") return false;
    const src = readFileSync(join("src/routes", f), "utf8");
    return !src.includes("beforeLoad") || !src.includes("me()");
  });
  check("admin routes resolving a session before load", unguarded.length, 0);
  unguarded.forEach((f) => line("   unguarded:", f));
  line("admin routes checked", routes.length);
}

console.log("\n═══ 2 · AUTHORIZATION BOUNDARY ═══");
{
  /* The eslint rule is the only thing stopping a handler querying unscoped.
     Prove it still fires rather than trusting the config is present. */
  const probe = "src/components/__security-probe.ts";
  const { writeFileSync, unlinkSync } = await import("node:fs");
  writeFileSync(
    probe,
    'import { db } from "@/server/db/client";\nimport { adminClient } from "@/server/auth/supabase.server";\nexport const x = [db, adminClient];\n',
  );
  let blocked = 0;
  try {
    execFileSync("npx", ["eslint", probe], { encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    blocked = (error.stdout ?? "").match(/no-restricted-imports/g)?.length ?? 0;
  } finally {
    unlinkSync(probe);
  }
  check("raw db + service-role imports blocked outside the scoped layer", blocked, 2);
}

console.log("\n═══ 3 · RLS AND DATA ISOLATION ═══");
{
  const [{ n: tables }] = await sql`
    select count(*)::int n from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE' and table_name <> '__drizzle_migrations'`;
  const unprotected = await sql`
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false`;
  const policies = await sql`select 1 from pg_policies where schemaname='public'`;
  const grants = await sql`
    select 1 from information_schema.role_table_grants
    where table_schema='public' and grantee in ('anon','authenticated')`;

  line("application tables", tables);
  check("tables WITHOUT row level security", unprotected.length, 0);
  unprotected.forEach((r) => line("   unprotected:", r.relname));
  check("RLS policies (deny by omission)", policies.length, 0);
  check("table grants to anon/authenticated", grants.length, 0);
}

console.log("\n═══ 4 · THE ANON KEY REACHES NOTHING ═══");
{
  let leaks = 0;
  for (const t of [
    "users",
    "opportunities",
    "people",
    "companies",
    "commission_entries",
    "audit_log",
    "erasures",
    "email_outbox",
    "targets",
    "commission_rules",
  ]) {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${t}?select=*&limit=1`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    });
    const body = await res.text();
    let rows = null;
    try {
      const j = JSON.parse(body);
      if (Array.isArray(j)) rows = j.length;
    } catch {
      /* not json */
    }
    if (res.ok && rows) {
      leaks += 1;
      line(`   LEAK /${t}`, `${rows} rows`);
    }
  }
  check("tables readable with the anon key", leaks, 0);
}

console.log("\n═══ 5 · SERVER-ONLY SECRETS ═══");
{
  const dirs = [".vercel/output/static", ".output/public", "dist/client"];
  const walk = (d, out = []) => {
    let entries;
    try {
      entries = readdirSync(d);
    } catch {
      return out;
    }
    for (const e of entries) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(js|mjs|css|html|json|map|txt)$/i.test(e)) out.push(full);
    }
    return out;
  };
  const files = dirs.flatMap((d) => walk(d));
  const needles = [
    ["service_role JWT", /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\./],
    ["sb_secret_ key", /\bsb_secret_[A-Za-z0-9_-]{10,}/],
    ["SUPABASE_SERVICE_ROLE_KEY", /SUPABASE_SERVICE_ROLE_KEY/],
    ["postgres connection string", /postgres(ql)?:\/\/[^\s"'`]*:[^\s"'`@]+@/],
    ["pooler host", /pooler\.supabase\.com/],
  ];
  let hits = 0;
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const [label, re] of needles) {
      if (re.test(text)) {
        if (label === "service_role JWT") {
          try {
            const tok = text.match(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\./)[0];
            const payload = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString());
            if (payload?.role !== "service_role") continue;
          } catch {
            continue;
          }
        }
        hits += 1;
        line(`   ${label} in`, f);
      }
    }
  }
  line("client files scanned", files.length);
  check("secrets in client output", hits, 0);

  const serverFiles = walk(".vercel/output/functions");
  let baked = 0;
  for (const f of serverFiles.slice(0, 400)) {
    const text = readFileSync(f, "utf8");
    if (
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      text.includes(process.env.SUPABASE_SERVICE_ROLE_KEY)
    )
      baked += 1;
  }
  check("service role key baked into server output", baked, 0);
}

console.log("\n═══ 6 · SESSION INVALIDATION ═══");
{
  const ctxSrc = readFileSync("src/server/auth/context.ts", "utf8");
  check("ctx reads the users row every request", ctxSrc.includes("loadContext"), true);
  check("a non-active status is rejected", ctxSrc.includes('row.status !== "active"'), true);
  check("role is never read from a JWT claim", /claims\?\.\w*role/.test(ctxSrc), false);
  const acctSrc = readFileSync("src/server/auth/accounts.ts", "utf8");
  check("deactivation revokes the refresh token", acctSrc.includes("revokeUserSessions"), true);
}

console.log("\n═══ 7 · COMMISSION INTEGRITY ═══");
{
  const src = readFileSync("src/server/domain/commission.ts", "utf8");
  check(
    "no hardcoded percentage in the commission module",
    /ratePct\s*[:=]\s*["']?\d/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    false,
  );
  check("the earned entry copies the rule (locked)", src.includes("lockedBasis"), true);
  check("reversal links what it reverses", src.includes("reversesEntryId"), true);

  const [{ n: orphan }] = await sql`
    select count(*)::int n from commission_entries
    where entry_type = 'reversal' and reverses_entry_id is null`;
  check("reversal rows with no link", orphan, 0);

  const [{ n: unbalanced }] = await sql`
    select count(*)::int n from (
      select o.id from opportunities o
      where o.cancelled_at is not null
        and exists (select 1 from commission_entries ce
                    where ce.opportunity_id = o.id and ce.entry_type <> 'reversal')
        and coalesce((select sum(amount) from commission_entries ce
                      where ce.opportunity_id = o.id), 0) <> 0
    ) x`;
  check("cancelled deals with a non-zero commission balance", unbalanced, 0);
}

console.log("\n═══ 8 · NO INVENTED DATA ═══");
{
  for (const t of [
    "people",
    "companies",
    "opportunities",
    "commission_entries",
    "targets",
    "activities",
    "form_submissions",
  ]) {
    const [{ n }] = await sql.unsafe(`select count(*)::int n from "${t}"`);
    check(`${t} rows`, n, 0);
  }
  const [{ n: stages }] = await sql`select count(*)::int n from pipeline_stages`;
  line("pipeline stages (configuration)", stages);
  const [{ n: eds }] = await sql`select count(*)::int n from editions`;
  line("editions (published facts)", eds);
}

await sql.end();
console.log(`\n${failures === 0 ? "SECURITY AUDIT PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
