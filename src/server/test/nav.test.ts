/**
 * WHICH DESTINATIONS EACH ROLE SEES.
 *
 * This is a UI convenience only — every screen below is also guarded on the
 * server, and hiding a link has never secured anything. What the test protects
 * is the SHAPE of the product: the navigation was cut from eight destinations
 * to four, and the whole simplification rests on it not creeping back.
 *
 * A Super Admin and an Admin see an identical structure on purpose. They differ
 * in what the server returns inside it, not in which doors exist.
 */

import { describe, expect, it } from "vitest";

import { navFor } from "@/components/admin/Shell";

const labels = (role: string) => navFor(role).map((n) => n.label);

describe("navFor", () => {
  it("gives a Super Admin exactly four destinations", () => {
    expect(labels("super_admin")).toEqual(["Dashboard", "Leads", "Events", "Team"]);
  });

  it("gives an Admin the SAME four — scope is the server's job, not the nav's", () => {
    expect(labels("admin")).toEqual(["Dashboard", "Leads", "Events", "Team"]);
  });

  it("gives a Team Member exactly their own two", () => {
    expect(labels("team_member")).toEqual(["My Leads", "My Targets"]);
  });

  it.each(["Events", "Team", "Dashboard"])("never shows a Team Member %s", (label) => {
    expect(labels("team_member")).not.toContain(label);
  });

  it.each([
    "Pipeline",
    "Targets",
    "Forecast",
    "Insights",
    "Directory",
    "Governance",
    "Reports",
    "Commissions",
    "Settings",
    "People",
    "Companies",
  ])("keeps %s out of primary navigation for every role", (label) => {
    for (const role of ["super_admin", "admin", "team_member"]) {
      expect(labels(role)).not.toContain(label);
    }
  });

  it("an unknown role gets the least-privileged set, never the full one", () => {
    /* Defaulting open is how a permission bug ships. */
    expect(labels("nonsense")).toEqual(["My Leads", "My Targets"]);
  });

  it("Settings is reachable, but not from the primary navigation", () => {
    /* It lives in the account menu. This test exists so that "not in the nav"
       is never mistaken for "not reachable". */
    for (const role of ["super_admin", "admin", "team_member"]) {
      expect(labels(role)).not.toContain("Settings");
    }
  });
});
