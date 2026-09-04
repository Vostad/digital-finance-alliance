/**
 * ONE CODEBASE, TWO PUBLIC ORIGINS.
 *
 * Radar is published on railsradar.com, the platform on financialrails.org,
 * from the same deployment and the same route tree. Every rule that keeps them
 * apart is a pure function, so all of it is provable here without a server, a
 * database or DNS.
 *
 * THE BUG THIS SUITE EXISTS BECAUSE OF: the scoping check originally ran
 * against the INTERNAL path, which on the Radar host always begins with
 * `/radar` because the input rewrite puts it there. "Starts with /radar" was
 * therefore always true, the redirect branch was unreachable, and
 * railsradar.com/forums would have 404ed instead of going home. It was found by
 * reading a rendered `/contact` link, not by any check that existed.
 */

import { describe, expect, it } from "vitest";

import {
  PLATFORM_ORIGIN,
  RADAR_ORIGIN,
  addRadarPrefix,
  isRadarHost,
  isRadarPublicPath,
  radarRewrite,
  radarUrl,
  stripRadarPrefix,
} from "@/lib/radar-host";

const at = (host: string, path: string) => new URL(`https://${host}${path}`);

describe("host recognition", () => {
  it.each(["railsradar.com", "www.railsradar.com", "RailsRadar.com", "railsradar.com:443"])(
    "%s is the Radar origin",
    (h) => expect(isRadarHost(h)).toBe(true),
  );

  it.each(["financialrails.org", "www.financialrails.org", "digital-financa.vercel.app", ""])(
    "%s is not",
    (h) => expect(isRadarHost(h)).toBe(false),
  );

  it("never mistakes a lookalike for the real thing", () => {
    expect(isRadarHost("railsradar.com.evil.example")).toBe(false);
    expect(isRadarHost("notrailsradar.com")).toBe(false);
  });
});

describe("the path rewrite is a round trip", () => {
  it.each([
    ["/", "/radar"],
    ["/corridors", "/radar/corridors"],
    ["/corridors/uae-to-india", "/radar/corridors/uae-to-india"],
    ["/rails", "/radar/rails"],
    ["/privacy", "/radar/privacy"],
  ])("public %s <-> internal %s", (pub, internal) => {
    expect(addRadarPrefix(pub)).toBe(internal);
    expect(stripRadarPrefix(internal)).toBe(pub);
  });

  it("is idempotent — prefixing twice does not double it", () => {
    expect(addRadarPrefix(addRadarPrefix("/corridors"))).toBe("/radar/corridors");
    expect(stripRadarPrefix(stripRadarPrefix("/radar/corridors"))).toBe("/corridors");
  });

  it("input then output returns the original URL, on the Radar host", () => {
    for (const p of ["/", "/corridors", "/corridors/uae-to-india", "/rails/swift"]) {
      const original = at("railsradar.com", p);
      const internal = radarRewrite.input({ url: original });
      expect(internal.pathname).toBe(addRadarPrefix(p));
      expect(radarRewrite.output({ url: internal }).pathname).toBe(p);
    }
  });

  /* The whole point of host-conditioning: financialrails.org must be untouched. */
  it("leaves the platform origin completely alone", () => {
    for (const p of ["/", "/forums", "/admin/radar", "/radar/corridors"]) {
      const u = at("financialrails.org", p);
      expect(radarRewrite.input({ url: u }).pathname).toBe(p);
      expect(radarRewrite.output({ url: u }).pathname).toBe(p);
    }
  });

  it("preserves the query string", () => {
    const u = at("railsradar.com", "/corridors/uae-to-india");
    u.search = "?amount=50000";
    expect(radarRewrite.input({ url: u }).search).toBe("?amount=50000");
  });
});

describe("what the Radar origin will and will not serve", () => {
  it.each(["/", "/corridors", "/corridors/uae-to-india", "/providers/x", "/rails/y", "/privacy"])(
    "serves %s",
    (p) => expect(isRadarPublicPath(p)).toBe(true),
  );

  /**
   * THE REGRESSION. Each of these was reachable — and 404ing — while the check
   * ran against the internal path. Admin is on the list deliberately: it stays
   * behind the one login on the platform origin.
   */
  it.each(["/admin", "/admin/radar", "/forums", "/about", "/council", "/fr30", "/contact"])(
    "does NOT serve %s — it belongs to the platform",
    (p) => expect(isRadarPublicPath(p)).toBe(false),
  );

  it("cannot be fooled by a path that merely mentions radar", () => {
    expect(isRadarPublicPath("/radar")).toBe(false);
    expect(isRadarPublicPath("/radarish")).toBe(false);
  });
});

describe("canonical URLs name the indexed origin", () => {
  it.each([
    ["/radar", `${RADAR_ORIGIN}/`],
    ["/radar/corridors", `${RADAR_ORIGIN}/corridors`],
    ["/radar/corridors/uae-to-india", `${RADAR_ORIGIN}/corridors/uae-to-india`],
  ])("%s -> %s", (internal, expected) => expect(radarUrl(internal)).toBe(expected));

  it("never emits the platform origin for a Radar page", () => {
    expect(radarUrl("/radar/corridors")).not.toContain("financialrails.org");
  });

  it("the two origins are distinct and both https", () => {
    expect(RADAR_ORIGIN).toBe("https://railsradar.com");
    expect(PLATFORM_ORIGIN).toBe("https://financialrails.org");
  });
});

describe("no Radar page hardcodes the old URL any more", () => {
  it("canonicals and og:url name railsradar.com", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "src/routes");
    for (const f of readdirSync(dir).filter((x) => x.startsWith("radar") && x.endsWith(".tsx"))) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, `${f} still points canonical at the old origin`).not.toContain(
        "financialrails.org/radar",
      );
    }
  });

  it("Radar links go through the router, so the output rewrite applies to them", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const files = [
      ...readdirSync(join(process.cwd(), "src/routes"))
        .filter((x) => x.startsWith("radar") && x.endsWith(".tsx"))
        .map((x) => join(process.cwd(), "src/routes", x)),
      join(process.cwd(), "src/components/radar/Shell.tsx"),
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      /* A bare <a href="/radar/..."> bypasses the rewrite and would emit a path
         that only resolves on the other origin. */
      expect(src, `${f} has a bare anchor to an internal Radar path`).not.toMatch(
        /href=\{?[`"]\/radar/,
      );
    }
  });
});
