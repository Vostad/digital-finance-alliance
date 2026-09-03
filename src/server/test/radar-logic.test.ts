/**
 * RAILS RADAR — the two pieces of logic that can quietly lie.
 *
 * Amount filtering and slug generation are both places where a reasonable-
 * looking implementation produces a dishonest result: a route hidden because
 * its limit is unknown, or a URL that changes under a corridor and breaks every
 * inbound link to it. Both are pure, so both are proved here with no database.
 */

import { describe, expect, it } from "vitest";

import { filterRoutesByAmount, type PublicRoute } from "../radar/public";
import { corridorSlug, slugify } from "../radar/slug";

/** A route with no published limits — the normal case at launch. */
function route(over: Partial<PublicRoute> = {}): PublicRoute {
  return {
    id: crypto.randomUUID(),
    type: "bank",
    rail: { id: "r", slug: "r", name: "Rail", category: "traditional", isMessagingNetwork: false },
    provider: { id: "p", slug: "p", name: "Provider", type: "bank" },
    limitMin: null,
    limitMax: null,
    limitCurrency: null,
    settlementFinality: null,
    settlementSystem: null,
    operatingHours: null,
    cutOff: null,
    assets: [],
    networks: [],
    requirements: [],
    licences: [],
    lastVerifiedAt: null,
    lastVerifiedBy: null,
    sourceUrl: null,
    ...over,
  };
}

const sourced = (value: string) => ({
  value,
  sourceUrl: "https://example.com/terms",
  sourceType: "provider_docs" as const,
  verifiedAt: null,
  verifiedBy: null,
});

describe("amount filters by published limits, and only by published limits", () => {
  it("does nothing when no amount is given", () => {
    const routes = [route(), route()];
    const out = filterRoutesByAmount(routes, null, "USD");
    expect(out.routes).toHaveLength(2);
    expect(out.excluded).toBe(0);
  });

  it("excludes a route whose published maximum is below the amount", () => {
    const r = route({ limitMax: sourced("1000"), limitCurrency: "USD" });
    const out = filterRoutesByAmount([r], 5000, "USD");
    expect(out.routes).toHaveLength(0);
    expect(out.excluded).toBe(1);
  });

  it("excludes a route whose published minimum is above the amount", () => {
    const r = route({ limitMin: sourced("10000"), limitCurrency: "USD" });
    expect(filterRoutesByAmount([r], 500, "USD").routes).toHaveLength(0);
  });

  it("keeps a route when the amount sits inside the published band", () => {
    const r = route({ limitMin: sourced("100"), limitMax: sourced("10000"), limitCurrency: "USD" });
    expect(filterRoutesByAmount([r], 5000, "USD").routes).toHaveLength(1);
  });

  it("keeps the boundary values themselves — a limit is inclusive", () => {
    const r = route({ limitMin: sourced("100"), limitMax: sourced("10000"), limitCurrency: "USD" });
    expect(filterRoutesByAmount([r], 100, "USD").routes).toHaveLength(1);
    expect(filterRoutesByAmount([r], 10000, "USD").routes).toHaveLength(1);
  });

  /* THE ONE THAT MATTERS MOST. An unpublished limit is not evidence of a limit,
     and hiding a route on that basis would be inventing data by omission — the
     same sin as inventing a fee, just harder to notice. */
  it("never excludes a route whose limits are not published", () => {
    const r = route();
    const out = filterRoutesByAmount([r], 999_999_999, "USD");
    expect(out.routes).toHaveLength(1);
    expect(out.excluded).toBe(0);
  });

  it("never excludes on a half-published band", () => {
    const onlyMin = route({ limitMin: sourced("100"), limitCurrency: "USD" });
    expect(filterRoutesByAmount([onlyMin], 999_999, "USD").routes).toHaveLength(1);

    const onlyMax = route({ limitMax: sourced("10000"), limitCurrency: "USD" });
    expect(filterRoutesByAmount([onlyMax], 1, "USD").routes).toHaveLength(1);
  });

  /* Comparing across currencies needs an FX rate. This product does not have
     one, and inventing one to filter a list is exactly what V1 refuses to do. */
  it("never excludes when the limit is denominated in another currency", () => {
    const r = route({ limitMax: sourced("1000"), limitCurrency: "BRL" });
    const out = filterRoutesByAmount([r], 5000, "USD");
    expect(out.routes).toHaveLength(1);
    expect(out.excluded).toBe(0);
  });

  it("reports how many it hid, so the page can say so", () => {
    const kept = route({ limitMax: sourced("10000"), limitCurrency: "USD" });
    const hidden = route({ limitMax: sourced("100"), limitCurrency: "USD" });
    const out = filterRoutesByAmount([kept, hidden, route()], 5000, "USD");
    expect(out.routes).toHaveLength(2);
    expect(out.excluded).toBe(1);
  });
});

describe("slugs are stable, lowercase and URL-safe", () => {
  it("builds the corridor form the SEO strategy depends on", () => {
    expect(corridorSlug("United States", "Brazil")).toBe("united-states-to-brazil");
  });

  it("strips accents rather than percent-encoding them", () => {
    expect(slugify("Côte d'Ivoire")).toBe("cote-d-ivoire");
  });

  it("collapses punctuation and trims the edges", () => {
    expect(slugify("  Hong Kong (SAR) — China  ")).toBe("hong-kong-sar-china");
  });

  it("is idempotent, so re-slugging a slug never changes it", () => {
    const once = corridorSlug("United Arab Emirates", "India");
    expect(slugify(once)).toBe(once);
  });
});
