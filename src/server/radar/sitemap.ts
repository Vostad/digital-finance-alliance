/**
 * THE SITEMAP — generated from rows, never hand-maintained.
 *
 * The old public/sitemap.xml is a static file someone edits. That does not
 * scale to a corridor set, and worse, it goes stale silently: a corridor
 * published today would not be discoverable until somebody remembered.
 *
 * ONLY CORRIDORS WITH DATA ARE LISTED, and that is an SEO decision as much as a
 * build one. A few thousand near-identical pages that all say "nothing verified
 * yet" is thin content — it competes with itself, dilutes the corridors that do
 * have substance, and invites a site-wide quality problem. An empty corridor
 * still renders on request, and still converts a visitor into a contributor.
 * It just does not ask to be indexed until it has something to say.
 */

import { listPublishedCorridors, listPublishedProviders, listPublishedRails } from "./public";
import { listRoutesForCorridor } from "./public";

const ORIGIN = "https://financialrails.org";

function url(loc: string, lastmod: Date | null, priority: string): string {
  const parts = [`    <loc>${ORIGIN}${loc}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>`);
  parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

export async function radarSitemap(): Promise<string> {
  const [corridors, providers, rails] = await Promise.all([
    listPublishedCorridors(),
    listPublishedProviders(),
    listPublishedRails(),
  ]);

  /* A corridor earns a sitemap entry by having at least one published route.
     Checked rather than assumed — a corridor row can be published while its
     routes are still drafts. */
  const withRoutes = await Promise.all(
    corridors.map(async (c) => ({ c, routes: (await listRoutesForCorridor(c.id)).length })),
  );
  const substantive = withRoutes.filter((x) => x.routes > 0).map((x) => x.c);

  const entries = [
    url("/radar", null, "0.9"),
    url("/radar/corridors", null, "0.8"),
    /* The two index pages. They carry the internal links that make every
       detail page reachable by a crawler, so they belong in here at least as
       high as the pages they point at. */
    url("/radar/rails", null, "0.8"),
    url("/radar/providers", null, "0.7"),
    ...substantive.map((c) =>
      url(`/radar/corridors/${c.slug}`, c.lastVerifiedAt ?? c.updatedAt, "0.7"),
    ),
    ...providers.map((p) => url(`/radar/providers/${p.slug}`, p.lastVerifiedAt, "0.6")),
    ...rails.map((r) => url(`/radar/rails/${r.slug}`, r.lastVerifiedAt, "0.5")),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

/** Corridors with no routes are explicitly kept out of the index. */
export const EMPTY_CORRIDOR_ROBOTS = "noindex, follow";
