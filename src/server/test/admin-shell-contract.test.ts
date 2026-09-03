/**
 * TWO BUGS THAT WERE INVISIBLE TO EVERY OTHER CHECK.
 *
 * Both shipped through typecheck, lint, build and 334 tests, because both are
 * about a DEFAULT being wrong rather than a value being absent. Nothing threw.
 *
 *   1. `<Shell>` takes an OPTIONAL `role`. Omit it and the nav does not fail —
 *      it renders `navFor("team_member")`, the least-privileged menu. So
 *      /admin/radar showed "My Leads · My Targets" to a Super Admin, on the
 *      same session where /admin showed all five destinations.
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
 * Real but minor, and it is CRM code: this branch is Rails Radar and is kept
 * clean of CRM edits by decision. One line — `role={user?.role}` — closes it
 * whenever that file is next opened.
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

  it("Radar's own screen passes it — the bug this test was written for", () => {
    const src = readFileSync(join(root, "src/routes/admin.radar.tsx"), "utf8");
    const tags = shellTags(src);
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) expect(t.replace(/\s+/g, " ")).toMatch(/role=\{data\.viewer\.role\}/);
  });

  /* The reason it matters, stated as behaviour rather than as a source check. */
  it("omitting the role yields the least-privileged nav, not an error", () => {
    expect(navFor("team_member").map((n) => n.label)).toEqual(["My Leads", "My Targets"]);
    expect(navFor("super_admin").map((n) => n.label)).toEqual([
      "Dashboard",
      "Leads",
      "Events",
      "Team",
      "Radar",
    ]);
  });

  it("an unknown role still falls back closed, which is why the bug was silent", () => {
    expect(navFor("nonsense").map((n) => n.label)).toEqual(["My Leads", "My Targets"]);
  });
});

describe("verification dates are the editor's calendar date, never the server's", () => {
  const forms = readFileSync(join(root, "src/components/admin/RadarForms.tsx"), "utf8");

  it("no date default is derived from toISOString", () => {
    expect(forms).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
  });

  it("builds the value from local calendar parts", () => {
    expect(forms).toContain("getFullYear()");
    expect(forms).toContain("getMonth() + 1");
    expect(forms).toContain("getDate()");
  });

  /**
   * The failure, reproduced. A UTC-derived date disagrees with the local one for
   * part of every day at any positive offset — which is exactly the window an
   * editor in Dubai does their evening work in.
   */
  it("UTC and local disagree for an evening east of Greenwich", () => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    /* 2026-09-03T21:30Z is 2026-09-04 01:30 in GST+4. */
    const instant = new Date("2026-09-03T21:30:00Z");
    expect(instant.toISOString().slice(0, 10)).toBe("2026-09-03");

    /* Asserted through a real +04:00 wall clock rather than the host's zone, so
       the test means the same thing wherever CI runs it. */
    const gst = new Date(instant.getTime() + 4 * 60 * 60 * 1000);
    const gstCalendarDate = `${gst.getUTCFullYear()}-${pad(gst.getUTCMonth() + 1)}-${pad(gst.getUTCDate())}`;
    expect(gstCalendarDate).toBe("2026-09-04");
    expect(gstCalendarDate).not.toBe(instant.toISOString().slice(0, 10));

    /* And the helper agrees with the wall clock it is run under. */
    const now = new Date();
    expect(local(now)).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    );
  });
});
