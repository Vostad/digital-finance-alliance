/**
 * EVERY SERVER FUNCTION MUST HAVE A WAY TO REACH IT.
 *
 * Every other check in this repo verifies that what exists is CORRECT. None
 * verified that what exists is REACHABLE, and those are different properties. A
 * server function with no caller is well-typed, lint-clean, fully covered by its
 * own unit tests, and never runs. Nothing goes red. It is simply not there.
 *
 * Found in Rails Radar: `saveRoute` shipped implemented, validated, ontology-
 * enforced and migrated, with no screen at all — Radar's central object could
 * not be created by any means. Alongside it every upsert could create and none
 * could edit, which silently made the re-verification queue decorative, because
 * re-verifying a record IS an edit.
 *
 * THE SAME EXPOSURE IS NOT SPECIFIC TO RADAR, which is why this suite covers
 * `src/rpc` entirely rather than Radar alone. Deleting a screen while leaving
 * its server function in place is the exact condition that creates an orphaned
 * mutation, and an admin simplification does that by design. This is the guard
 * for it: after any such pass, a mutation that lost its last caller fails here
 * rather than lingering as an authenticated endpoint nobody maintains.
 *
 * THE RULE. Every `createServerFn` in `src/rpc` either has a reference from the
 * UI, or appears on `KNOWN_UNREFERENCED` below with a stated reason. The list is
 * asserted EXACTLY in both directions — a new orphan fails, and so does an entry
 * that has quietly been wired up and not removed. And a write may never be
 * added to it: `GRANDFATHERED_WRITES` is frozen and may only shrink.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/* ----------------------------------------------------- the two inventories -- */

type Fn = { name: string; module: string; method: string };

const rpcFunctions: Fn[] = readdirSync(join(root, "src/rpc"))
  .filter((f) => f.endsWith(".ts"))
  .flatMap((file) => {
    const src = readFileSync(join(root, "src/rpc", file), "utf8");
    return [...src.matchAll(/export const (\w+) = createServerFn\(\{\s*method: "(\w+)"/g)].map(
      (m) => ({ name: m[1]!, module: file, method: m[2]! }),
    );
  });

/** Everything a person can reach — routes and components. `src/rpc` is excluded
    so an RPC module re-exporting a name cannot count as a caller, and the test
    layer is excluded so a test cannot keep dead code alive. */
function uiSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "test" || rel === "src/rpc") continue;
      uiSources(rel, acc);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      acc.push(readFileSync(join(root, rel), "utf8"));
    }
  }
  return acc;
}
const ui = uiSources("src").join("\n");

const isReferenced = (name: string) => new RegExp(`\\b${name}\\b`).test(ui);

/* --------------------------------------------------------------- the debt -- */

/**
 * Server functions with no UI path, each one looked at rather than assumed.
 *
 * `kind` is a HUMAN judgement, checked by reading what the function's domain
 * call actually does — it is not inferred from the HTTP method, because most of
 * these are reads that use POST to pass parameters. Two names mislead:
 * `recordHistory` only reads (`historyFor`), and `emailStatus` only reads
 * (`outboxSummary`).
 *
 * Everything here predates Rails Radar. Most of it was almost certainly orphaned
 * by the Phase 2 admin simplification, which cut the navigation from eight
 * destinations to four — screens went, server functions stayed.
 */
const KNOWN_UNREFERENCED: Array<{ name: string; kind: "read" | "write"; why: string }> = [
  // ---- reads. Harmless but dead: they compute and return, nothing more. ----
  { name: "emailStatus", kind: "read", why: "outbox summary; no screen surfaces it" },
  { name: "forecastView", kind: "read", why: "forecast was cut from the nav in Phase 2" },
  { name: "productivityInsights", kind: "read", why: "insights screen was cut in Phase 2" },
  { name: "productivityMetrics", kind: "read", why: "insights screen was cut in Phase 2" },
  { name: "recordHistory", kind: "read", why: "reads history only, despite the name" },
  {
    name: "owners",
    kind: "read",
    why: "assignable users; the lead detail screen stopped using it",
  },
  { name: "searchPeopleAndCompanies", kind: "read", why: "directory search; no caller remains" },
  { name: "workstreamsForPerson", kind: "read", why: "other workstreams; no caller remains" },

  // ---- writes. These are DEFECTS, recorded, not accepted. See GRANDFATHERED. ----
  { name: "setProbability", kind: "write", why: "overrideProbability — orphaned write" },
  { name: "setCommissionSplit", kind: "write", why: "setSplit — orphaned write" },
  { name: "changeTarget", kind: "write", why: "updateTarget — orphaned write" },
  { name: "retryEmail", kind: "write", why: "drainOutbox — orphaned write" },
];

/**
 * THE FROZEN SET. Four writes that were already orphaned when this suite was
 * written, on 4 September 2026. They are authenticated and authorized
 * server-side, so this is dead code rather than an open door — but a write
 * nobody can reach is a write nobody maintains, and each needs a decision:
 * wire it to a screen, or delete it.
 *
 * THIS LIST MAY ONLY SHRINK. Adding a fifth fails the assertion below, which is
 * what makes "a mutation may never be parked on the debt list" enforceable
 * rather than a convention.
 */
const GRANDFATHERED_WRITES = [
  "changeTarget",
  "retryEmail",
  "setCommissionSplit",
  "setProbability",
] as const;

/* ---------------------------------------------------------------- the law -- */

describe("the RPC surface is inventoried", () => {
  it("finds every server function across every rpc module", () => {
    expect(rpcFunctions.length).toBeGreaterThan(60);
    expect(new Set(rpcFunctions.map((f) => f.module)).size).toBeGreaterThan(8);
  });

  it("every name is unique, so a reference is unambiguous", () => {
    const names = rpcFunctions.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("every server function is reachable, or is declared debt", () => {
  const declared = new Set(KNOWN_UNREFERENCED.map((d) => d.name));

  it.each(rpcFunctions.filter((f) => !declared.has(f.name)).map((f) => [f.name, f.module]))(
    "%s (%s) has a UI path",
    (name) => {
      expect(isReferenced(name)).toBe(true);
    },
  );

  it("the debt list is exactly the set with no UI path — no more, no fewer", () => {
    const actual = rpcFunctions
      .filter((f) => !isReferenced(f.name))
      .map((f) => f.name)
      .sort();
    expect(actual).toEqual([...declared].sort());
  });

  it("every declared entry names a function that still exists", () => {
    const all = new Set(rpcFunctions.map((f) => f.name));
    for (const d of KNOWN_UNREFERENCED) expect(all.has(d.name)).toBe(true);
  });

  it("every declared entry gives a reason", () => {
    for (const d of KNOWN_UNREFERENCED) expect(d.why.trim().length).toBeGreaterThan(10);
  });
});

describe("a write may never be parked on the debt list", () => {
  it("the orphaned writes are exactly the four grandfathered on 4 Sep 2026", () => {
    const writes = KNOWN_UNREFERENCED.filter((d) => d.kind === "write")
      .map((d) => d.name)
      .sort();
    expect(writes).toEqual([...GRANDFATHERED_WRITES].sort());
  });

  it("the grandfathered set may only shrink", () => {
    expect(GRANDFATHERED_WRITES.length).toBeLessThanOrEqual(4);
  });
});

/* --------------------------------------------------------- Radar specifics -- */

describe("the Radar surface is fully reachable", () => {
  const radar = rpcFunctions.filter((f) => f.module.startsWith("radar"));

  it("has no unreachable function of any kind", () => {
    expect(radar.filter((f) => !isReferenced(f.name)).map((f) => f.name)).toEqual([]);
  });

  it("carries no entry on the debt list", () => {
    const names = new Set(radar.map((f) => f.name));
    expect(KNOWN_UNREFERENCED.filter((d) => names.has(d.name))).toEqual([]);
  });
});

/**
 * Creating a record is half a CRUD. The other half is what re-verification,
 * acting on an inaccuracy report, and moving draft → published all depend on,
 * and its absence is invisible from outside: the form works, it only inserts.
 */
describe("every Radar upsert can edit, not only create", () => {
  const forms = readFileSync(join(root, "src/components/admin/RadarForms.tsx"), "utf8");

  it.each([
    ["saveRail", "RailForm"],
    ["saveProvider", "ProviderForm"],
    ["saveCorridor", "CorridorForm"],
    ["saveRoute", "RouteForm"],
    ["saveLicence", "LicenceForm"],
  ])("%s is called with an existing id by %s", (fn, form) => {
    const start = forms.indexOf(`export function ${form}`);
    expect(start).toBeGreaterThan(-1);
    const body = forms.slice(start, start + 6000);
    expect(body).toContain(fn);
    /* The id is what turns an insert into an update, server-side. */
    expect(body).toMatch(/id: initial\?\.id \?\? null/);
  });
});

/**
 * The moderation gate, asserted from the other side: no path in the admin UI
 * may push a submitter's claim into a live field.
 */
describe("reviewing a submission cannot write to a record", () => {
  const rpc = readFileSync(join(root, "src/rpc/radar-admin.ts"), "utf8");
  const domain = readFileSync(join(root, "src/server/radar/admin.ts"), "utf8");

  it("decideSubmission takes only an id, a status and a note", () => {
    const body = rpc.slice(rpc.indexOf("export const decideSubmission"), rpc.length).slice(0, 800);
    expect(body).toContain("id:");
    expect(body).toContain("status:");
    expect(body).toContain("note:");
    expect(body).not.toMatch(/\b(field|value|apply|promote)\b/i);
  });

  it("reviewSubmission only ever updates radar_submissions", () => {
    const start = domain.indexOf("export async function reviewSubmission");
    const body = domain.slice(start, domain.indexOf("/* ====", start));
    expect([...body.matchAll(/\.update\((\w+)\)/g)].map((m) => m[1])).toEqual(["radarSubmissions"]);
  });
});
