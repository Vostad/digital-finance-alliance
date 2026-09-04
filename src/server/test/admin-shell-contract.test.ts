/**
 * TWO BUGS THAT WERE INVISIBLE TO EVERY OTHER CHECK.
 *
 * Both shipped through typecheck, lint, build and 334 tests, because both are
 * about a DEFAULT being wrong rather than a value being absent. Nothing threw.
 *
 *   1. `<Shell>` takes an OPTIONAL `role`. Omit it and the nav does not fail —
 *      it renders `navFor("team_member")`, the least-privileged menu. So
 *      an admin screen showed "My Leads · My Targets" to a Super Admin, on
 *      the same session where /admin showed every destination.
 *
 *   2. Date defaults used `toISOString()`, which is UTC. An editor in GST+4 at
 *      01:30 on the 4th is at 21:30 UTC on the 3rd, so every record entered
 *      late in the evening was stamped a day early. On a product whose claim is
 *      "verified on this date", that is a data-integrity bug wearing the
 *      costume of a formatting nit.
 *
 * A type cannot catch either: `role` is legitimately optional, and both date
 * expressions are well-typed strings.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { navFor } from "@/components/admin/Shell";

const root = process.cwd();
const routes = readdirSync(join(root, "src/routes")).filter(
  (f) => f.startsWith("admin.") && f.endsWith(".tsx") && f !== "admin.login.tsx",
);

/**
 * Every `<Shell>` in the file, not just the first — a route often has a second
 * for its not-found or empty state, and checking only `indexOf` reports the
 * wrong one. That mistake produced a false positive the first time this test
 * ran, against a file whose real render was correct all along.
 */
function shellTags(src: string): string[] {
  const tags: string[] = [];
  let i = src.indexOf("<Shell");
  while (i !== -1) {
    const close = src.indexOf(">", i);
    tags.push(src.slice(i, close === -1 ? i + 400 : close + 1));
    i = src.indexOf("<Shell", i + 6);
  }
  return tags;
}

/**
 * KNOWN, RECORDED, NOT FIXED HERE.
 *
 * `admin.leads.$id.tsx` renders `<Shell title="Not found">` as an early return
 * when a workstream id does not resolve. It passes no role, so that one screen
 * draws a Team Member's nav for anybody. Its main render, further down the same
 * file, is correct.
 *
 * Real but minor. One line — `role={user?.role}` — closes it whenever that file
 * is next opened.
 */
const KNOWN_ROLELESS_SHELLS = ['admin.leads.$id.tsx:<Shell title="Not found">'];

describe("every admin screen tells the shell who is looking at it", () => {
  it.each(routes)("%s passes a role to every <Shell>", (file) => {
    const src = readFileSync(join(root, "src/routes", file), "utf8");
    for (const tag of shellTags(src)) {
      const flat = tag.replace(/\s+/g, " ").trim();
      if (KNOWN_ROLELESS_SHELLS.some((k) => k === `${file}:${flat}`)) continue;
      expect(flat).toMatch(/\brole=\{/);
    }
  });

  it("the recorded exceptions still exist — no stale entries", () => {
    for (const entry of KNOWN_ROLELESS_SHELLS) {
      const [file, tag] = entry.split(/:(.+)/);
      const src = readFileSync(join(root, "src/routes", file!), "utf8");
      const flat = shellTags(src).map((t) => t.replace(/\s+/g, " ").trim());
      expect(flat).toContain(tag);
    }
  });

  /* The reason it matters, stated as behaviour rather than as a source check. */
  it("omitting the role yields the least-privileged nav, not an error", () => {
    expect(navFor("team_member").map((n) => n.label)).toEqual(["My Leads", "My Targets"]);
    expect(navFor("super_admin").map((n) => n.label)).toEqual([
      "Dashboard",
      "Leads",
      "Events",
      "Team",
    ]);
  });

  it("an unknown role still falls back closed, which is why the bug was silent", () => {
    expect(navFor("nonsense").map((n) => n.label)).toEqual(["My Leads", "My Targets"]);
  });
});
