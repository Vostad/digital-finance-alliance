/**
 * REQUIREMENT 2 — proving the guard, not just having one.
 *
 * A build-time check nobody has ever seen fail is indistinguishable from a
 * build-time check that does not work. These tests plant a service-role key in
 * a fake client bundle and assert the build stops.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts/check-client-bundle.mjs");

/** Stand-in for a real HS256 signature — the length a leaked token would have. */
const SIGNATURE = "kQ7bV2xHn0LpR4tYzA9cW1eJm6sF8gUdNvXoIbTlPyM";
const made: string[] = [];

/** A syntactically real JWT whose payload says role: service_role. Signed with
    nothing — it never reaches an auth server, it only has to look like what
    would leak. */
function serviceRoleJwt() {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "service_role", iss: "supabase" })}.${SIGNATURE}`;
}

function anonJwt() {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "anon", iss: "supabase" })}.${SIGNATURE}`;
}

/** Build a throwaway project whose only content is one emitted client file. */
function bundleContaining(contents: string) {
  const dir = mkdtempSync(join(tmpdir(), "fr-os-bundle-"));
  made.push(dir);
  mkdirSync(join(dir, "dist/client/assets"), { recursive: true });
  writeFileSync(join(dir, "dist/client/assets/index-abc123.js"), contents, "utf8");
  return dir;
}

function run(cwd: string, env: NodeJS.ProcessEnv = {}) {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      cwd,
      env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: "", ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output: stdout };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { code: e.status, output: `${e.stdout}${e.stderr}` };
  }
}

afterEach(() => {
  while (made.length) rmSync(made.pop()!, { recursive: true, force: true });
});

describe("the client bundle leak check", () => {
  it("passes a clean bundle", () => {
    const result = run(bundleContaining('const a=1;export{a};console.log("hello");'));
    expect(result.code).toBe(0);
    expect(result.output).toContain("no secrets found");
  });

  it("does not object to the anon key, which is meant to ship", () => {
    expect(run(bundleContaining(`const k="${anonJwt()}";`)).code).toBe(0);
  });

  it("FAILS THE BUILD on a service_role JWT", () => {
    const result = run(bundleContaining(`const k="${serviceRoleJwt()}";`));
    expect(result.code).toBe(1);
    expect(result.output).toContain("SECRET LEAK IN CLIENT OUTPUT");
    expect(result.output).toContain('role "service_role"');
  });

  it("fails on the literal key value when it is present in the environment", () => {
    const secret = "super-secret-service-role-value-0123456789";
    const result = run(bundleContaining(`const k="${secret}";`), {
      SUPABASE_SERVICE_ROLE_KEY: secret,
    });
    expect(result.code).toBe(1);
    expect(result.output).toContain("the literal SUPABASE_SERVICE_ROLE_KEY value");
  });

  it("fails on a newer-format sb_secret_ key", () => {
    const result = run(bundleContaining('const k="sb_secret_9aBcDeFgHiJkLmNoPq";'));
    expect(result.code).toBe(1);
    expect(result.output).toContain("sb_secret_");
  });

  it("fails on the variable NAME appearing in client output", () => {
    const result = run(bundleContaining("const k=import.meta.env.SUPABASE_SERVICE_ROLE_KEY;"));
    expect(result.code).toBe(1);
    expect(result.output).toContain("the name SUPABASE_SERVICE_ROLE_KEY");
  });

  it("fails on a Postgres connection string, which carries the database password", () => {
    const result = run(
      bundleContaining(
        'const u="postgres://postgres:hunter2@aws-0-eu.pooler.supabase.com:6543/x";',
      ),
    );
    expect(result.code).toBe(1);
    expect(result.output).toContain("Postgres connection string");
  });

  it("FAILS RATHER THAN PASSES when there is no client output to scan", () => {
    /* A check that silently succeeds because it found nothing to look at is
       the most dangerous state this script could be in. */
    const empty = mkdtempSync(join(tmpdir(), "fr-os-empty-"));
    made.push(empty);
    const result = run(empty);
    expect(result.code).toBe(1);
    expect(result.output).toContain("found no client output to scan");
  });
});
