#!/usr/bin/env node
/**
 * REQUIREMENT 2 — THE BUILD-TIME LEAK CHECK.
 *
 * "Never in a client bundle, never in a VITE_-prefixed variable, never in a
 * loader that ships to the browser."  Those are rules a person has to keep
 * remembering. This is the part that does not depend on remembering.
 *
 * Scans every file emitted to the browser and fails the build on:
 *
 *   1. the literal service-role key, when it is present in this environment
 *   2. any JWT whose payload says  role: "service_role"  — catches the key
 *      arriving from somewhere other than the env var we know about
 *   3. `sb_secret_…` — the format Supabase's newer secret keys use
 *   4. the variable NAME, which in client output can only mean someone
 *      wrote `import.meta.env.SUPABASE_SERVICE_ROLE_KEY` or similar
 *   5. a Postgres connection string, which carries the database password
 *
 * Exit code 1 stops `npm run build`, and therefore stops the deploy.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

/** Everything a browser can fetch. Nitro's Vercel preset writes the first;
    the others are here so the check still works under other build targets
    rather than silently passing because it found no directory to scan. */
const CLIENT_DIRS = [".vercel/output/static", ".output/public", "dist/client", "dist/public"];

const TEXT = /\.(js|mjs|cjs|css|html|json|map|txt|svg|webmanifest)$/i;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT.test(entry)) out.push(full);
  }
  return out;
}

/** A JWT's middle segment is base64url JSON. Decode and look at the claim
    rather than pattern-matching the key, so a rotated key is still caught. */
function serviceRoleJwtIn(text) {
  const candidates = text.match(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g);
  if (!candidates) return null;
  for (const token of candidates) {
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      if (payload?.role === "service_role") return token.slice(0, 24) + "…";
    } catch {
      /* not a JWT we can read; the other checks still apply */
    }
  }
  return null;
}

const literalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const failures = [];
let scanned = 0;
let sawAnyDir = false;

for (const dir of CLIENT_DIRS) {
  const files = walk(join(ROOT, dir));
  if (files.length) sawAnyDir = true;

  for (const file of files) {
    scanned += 1;
    const text = readFileSync(file, "utf8");
    const where = relative(ROOT, file);

    if (literalKey && literalKey.length > 20 && text.includes(literalKey)) {
      failures.push([where, "the literal SUPABASE_SERVICE_ROLE_KEY value"]);
    }
    const jwt = serviceRoleJwtIn(text);
    if (jwt) failures.push([where, `a JWT with role "service_role" (${jwt})`]);

    if (/\bsb_secret_[A-Za-z0-9_-]{10,}/.test(text)) {
      failures.push([where, "a Supabase secret key (sb_secret_…)"]);
    }
    if (text.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      failures.push([where, "the name SUPABASE_SERVICE_ROLE_KEY"]);
    }
    if (/postgres(ql)?:\/\/[^\s"'`]*:[^\s"'`@]+@/.test(text)) {
      failures.push([where, "a Postgres connection string with a password"]);
    }
  }
}

if (!sawAnyDir) {
  console.error(
    "check:client-bundle found no client output to scan.\n" +
      `Looked in: ${CLIENT_DIRS.join(", ")}\n` +
      "Run it after `vite build`. Passing without scanning would be worse than failing.",
  );
  process.exit(1);
}

if (failures.length) {
  console.error("\n  SECRET LEAK IN CLIENT OUTPUT — build stopped.\n");
  for (const [file, what] of failures) console.error(`    ${file}\n      contains ${what}`);
  console.error(
    "\n  The service role key bypasses RLS and can mint a session for any user.\n" +
      "  Move the code that reads it behind a server function or a *.server.ts module,\n" +
      "  and rotate the key in the Supabase dashboard if this output was ever deployed.\n",
  );
  process.exit(1);
}

console.log(`check:client-bundle — ${scanned} client files scanned, no secrets found.`);
