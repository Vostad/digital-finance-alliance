/**
 * THE AUTHORIZATION BOUNDARY, CHECKED IN BOTH SPELLINGS.
 *
 * eslint.config.js is what makes an unscoped CRM query unavailable rather than
 * merely discouraged. That guarantee used to hold for only one of the two ways
 * the same import can be written: `no-restricted-imports` `group` patterns are
 * minimatch globs, and `**` does not match a specifier beginning with `../`.
 * So `@/server/db/client` was rejected and `../db/client` — the natural
 * spelling from src/server/domain, one directory away from src/server/db —
 * was not. Any domain module could hold the raw handle by spelling the import
 * relatively, and lint would agree it was fine.
 *
 * The three boundary patterns are anchored regexes now. This suite lints both
 * spellings through the real config, so if anyone converts them back to globs
 * the relative cases fail here rather than silently opening the CRM.
 */

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/** The project's own flat config — not a fixture of it. A test against a copy
    of the rules would pass while the shipped ones leaked. */
const eslint = new ESLint({ cwd: process.cwd() });

/**
 * Lint one import as if it were written in `filePath`, and return only the
 * restricted-import complaints. The fixture is a fragment, so prettier and the
 * unused-symbol rules have opinions about it that are not what is being tested.
 * `filePath` need not exist: the config is selected by path, and nothing here
 * is type-aware.
 */
async function restrictedImports(filePath: string, specifier: string): Promise<string[]> {
  const [result] = await eslint.lintText(`import * as probe from "${specifier}";\n`, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "no-restricted-imports")
    .map((message) => message.message);
}

/** A file one directory below src/server/db — where `../db/client` is the
    spelling a person would reach for without thinking about it. */
const DOMAIN_FILE = "src/server/domain/probe.ts";

/** The three modules the boundary exists to keep away from application code,
    each in both spellings, with a phrase unique to its message so a test
    cannot pass on the wrong rule firing. */
const GUARDED = [
  {
    module: "the raw db handle",
    relative: "../db/client",
    alias: "@/server/db/client",
    says: /scopedQuery\(ctx\)/,
  },
  {
    module: "the service-role Supabase client",
    relative: "../auth/supabase.server",
    alias: "@/server/auth/supabase.server",
    says: /bypasses RLS and can mint a session/,
  },
  {
    module: "the server environment",
    relative: "../env.server",
    alias: "@/server/env.server",
    says: /Secrets are read in one place/,
  },
] as const;

describe("application code cannot reach past the scoped layer", () => {
  describe.each(GUARDED)("$module", ({ relative, alias, says }) => {
    it(`rejects the alias spelling (${alias})`, async () => {
      const messages = await restrictedImports(DOMAIN_FILE, alias);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(says);
    });

    /* THE REGRESSION. A `group` glob misses this spelling entirely, which is
       how the boundary was bypassable for every file under src/server/domain. */
    it(`rejects the relative spelling (${relative})`, async () => {
      const messages = await restrictedImports(DOMAIN_FILE, relative);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(says);
    });
  });

  /** The regexes are anchored on the path tail, so depth is irrelevant — a
      route or a component reaching back up the tree is caught the same way. */
  it.each([
    ["src/routes/admin/probe.ts", "../../server/db/client"],
    ["src/components/probe.tsx", "../server/env.server"],
    ["src/server/domain/nested/probe.ts", "../../db/client"],
  ])("rejects %s importing %s, however far up it reaches", async (filePath, specifier) => {
    expect(await restrictedImports(filePath, specifier)).toHaveLength(1);
  });

  it("says nothing about imports that are not the guarded three", async () => {
    expect(await restrictedImports(DOMAIN_FILE, "../db/radar")).toEqual([]);
    expect(await restrictedImports(DOMAIN_FILE, "../auth/scoped")).toEqual([]);
    expect(await restrictedImports(DOMAIN_FILE, "zod")).toEqual([]);
  });
});

/**
 * The scoped layer is the thing doing the scoping, and the integration suite
 * has to open a raw connection to prove the filters hold once Postgres runs
 * them. Tightening the boundary must not have swept these up.
 */
describe("the layers that are exempt on purpose still are", () => {
  it.each([
    ["src/server/auth/scoped.ts", "../db/client"],
    ["src/server/auth/context.ts", "./supabase.server"],
    ["src/server/db/client.ts", "../env.server"],
    ["src/server/auth/supabase.server.ts", "../env.server"],
    ["src/server/test/scope-sql.test.ts", "../db/client"],
    ["src/server/test/integration/fixture.ts", "@/server/db/client"],
  ])("%s may still import %s", async (filePath, specifier) => {
    expect(await restrictedImports(filePath, specifier)).toEqual([]);
  });
});

/**
 * Radar's own blocks replace the boundary's rule rather than adding to it, so
 * those files keep the raw handle they are allowlisted for. What must not
 * loosen is the fence that replaced it: Radar cannot name a CRM table, cannot
 * touch the service-role client, and cannot enter the CRM domain layer.
 */
describe("the Radar fences are no weaker than before", () => {
  it.each([
    ["src/server/radar/public.ts", "../db/schema"],
    ["src/server/radar/public.ts", "@/server/db/schema"],
    ["src/server/radar/public.ts", "../auth/supabase.server"],
    ["src/server/radar/public.ts", "../domain/leads"],
    ["src/server/radar/submissions.ts", "../db/schema"],
    ["src/server/radar/admin.ts", "../db/schema"],
    ["src/server/radar/admin.ts", "@/server/auth/supabase.server"],
  ])("%s still cannot import %s", async (filePath, specifier) => {
    expect(await restrictedImports(filePath, specifier)).toHaveLength(1);
  });

  it.each([
    ["src/server/radar/public.ts", "../db/client"],
    ["src/server/radar/public.ts", "../db/radar"],
    ["src/server/radar/submissions.ts", "../db/client"],
  ])("%s keeps the handle it is allowlisted for (%s)", async (filePath, specifier) => {
    expect(await restrictedImports(filePath, specifier)).toEqual([]);
  });
});
