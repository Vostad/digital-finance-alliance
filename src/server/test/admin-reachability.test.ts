/**
 * EVERY SERVER MUTATION MUST HAVE A WAY TO REACH IT.
 *
 * `saveRoute` shipped fully implemented, validated, migrated — and with no
 * screen. Nothing failed. Types passed, lint passed, the build passed, and the
 * gap was invisible until someone tried to enter a route. Alongside it, every
 * upsert shipped able to create but never to edit, which quietly made the
 * re-verification queue decorative: re-verifying a record IS an edit.
 *
 * Both were found before any real data was entered, which is the only reason
 * they were cheap. This suite is what makes that luck repeatable.
 *
 * It is a REACHABILITY check, not a behaviour check: it asserts a UI path
 * exists, not that the path is correct. That is still worth having, because the
 * failure it catches is total — a function nobody can call does nothing at all.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/** Every .tsx under src/, excluding tests — the whole surface a person clicks. */
function uiSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "test") continue;
      uiSources(rel, acc);
    } else if (entry.name.endsWith(".tsx")) {
      acc.push(readFileSync(join(root, rel), "utf8"));
    }
  }
  return acc;
}

const ui = uiSources("src").join("\n");

const serverFns = (file: string) => {
  const src = readFileSync(join(root, file), "utf8");
  return [...src.matchAll(/export const (\w+) = createServerFn\(\{\s*method: "(\w+)"/g)].map(
    (m) => ({ name: m[1]!, method: m[2]! }),
  );
};

const adminFns = serverFns("src/rpc/radar-admin.ts");
const publicFns = serverFns("src/rpc/radar.ts");

describe("the Radar admin surface is fully reachable", () => {
  it("finds the admin server functions", () => {
    expect(adminFns.length).toBeGreaterThan(10);
  });

  it.each(adminFns.map((f) => [f.name, f.method]))("%s (%s) has a UI path", (name) => {
    expect(ui).toMatch(new RegExp(`\\b${name}\\b`));
  });
});

/**
 * KNOWN DEAD READ ENDPOINTS — recorded, not silenced.
 *
 * These two were written speculatively and no page consumes them: Radar has
 * `/radar/corridors` as a browsable index but no `/radar/rails` or
 * `/radar/providers`. Rail and provider DETAIL pages exist and are in the
 * sitemap, so this is also a small internal-linking gap — until a corridor
 * publishes, nothing on the site links to them.
 *
 * Left as a deliberate, visible decision pending: either build the two index
 * pages, or delete the endpoints. The assertion below is exact in both
 * directions — a third dead endpoint fails it, and so does building a page for
 * one of these without removing it from this list. Silence was the original
 * problem; this is the opposite of silence.
 */
const KNOWN_UNREACHABLE = ["railIndex", "providerIndex"];

describe("the public Radar surface is fully reachable", () => {
  const reachable = publicFns.filter((f) => !KNOWN_UNREACHABLE.includes(f.name));

  it.each(reachable.map((f) => [f.name, f.method]))("%s (%s) has a UI path", (name) => {
    expect(ui).toMatch(new RegExp(`\\b${name}\\b`));
  });

  it("has exactly the dead read endpoints we have accepted, no more and no fewer", () => {
    const dead = publicFns
      .filter((f) => !new RegExp(`\\b${f.name}\\b`).test(ui))
      .map((f) => f.name)
      .sort();
    expect(dead).toEqual([...KNOWN_UNREACHABLE].sort());
  });

  it("no MUTATION is ever on that list — a write nobody can reach is a bug, not debt", () => {
    for (const name of KNOWN_UNREACHABLE) {
      expect(publicFns.find((f) => f.name === name)?.method).toBe("GET");
    }
  });
});

/**
 * Creating a record is half a CRUD. The other half is what re-verification,
 * correcting an inaccuracy report, and moving draft → published all depend on,
 * and its absence is invisible from the outside: the form still works, it just
 * only ever inserts.
 */
describe("every upsert can edit, not only create", () => {
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

  it.each(["RailForm", "ProviderForm", "CorridorForm", "RouteForm", "LicenceForm"])(
    "%s accepts an initial record to edit",
    (form) => {
      const start = forms.indexOf(`export function ${form}`);
      expect(forms.slice(start, start + 1200)).toContain("initial");
    },
  );
});

/**
 * The moderation gate, asserted from the other side: there must be no way for
 * the admin UI to push a submitter's claim into a live field. Accepting a
 * submission records a judgement; an editor then types the record themselves.
 */
describe("reviewing a submission cannot write to a record", () => {
  const rpc = readFileSync(join(root, "src/rpc/radar-admin.ts"), "utf8");
  const domain = readFileSync(join(root, "src/server/radar/admin.ts"), "utf8");

  it("decideSubmission takes only an id, a status and a note", () => {
    const start = rpc.indexOf("export const decideSubmission");
    const body = rpc.slice(start, start + 800);
    expect(body).toContain("id:");
    expect(body).toContain("status:");
    expect(body).toContain("note:");
    /* No field name, no value — so no shape of call could promote a claim. */
    expect(body).not.toMatch(/\b(field|value|apply|promote)\b/i);
  });

  it("reviewSubmission only ever updates radar_submissions", () => {
    const start = domain.indexOf("export async function reviewSubmission");
    const body = domain.slice(start, domain.indexOf("/* ====", start));
    const updated = [...body.matchAll(/\.update\((\w+)\)/g)].map((m) => m[1]);
    expect(updated).toEqual(["radarSubmissions"]);
  });
});
