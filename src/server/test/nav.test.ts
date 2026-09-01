/**
 * WHICH DESTINATIONS EACH ROLE SEES.
 *
 * A link that bounces you back costs a click, a page load, and a moment
 * wondering what you did wrong. This is a UI convenience only — every one of
 * these screens is also guarded on the server, and hiding a link has never
 * secured anything.
 */

import { describe, expect, it } from "vitest";

import { NAV, navFor } from "@/components/admin/Shell";

describe("navFor", () => {
  it("shows a Super Admin every destination", () => {
    expect(navFor("super_admin")).toHaveLength(NAV.length);
    expect(navFor("super_admin").map((n) => n.label)).toContain("Governance");
  });

  it.each(["admin", "team_member"])("hides Governance from a %s", (role) => {
    expect(navFor(role).map((n) => n.label)).not.toContain("Governance");
  });

  it("still shows everyone the working screens", () => {
    const member = navFor("team_member").map((n) => n.label);
    expect(member).toEqual([
      "Today",
      "Pipeline",
      "Leads",
      "Targets",
      "Forecast",
      "Insights",
      "Directory",
    ]);
  });

  it("an unknown role gets the safe subset, never the full one", () => {
    /* Defaulting open is how a permission bug ships. */
    expect(navFor("nonsense").map((n) => n.label)).not.toContain("Governance");
  });
});
