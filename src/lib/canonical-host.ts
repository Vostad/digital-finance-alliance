/**
 * CANONICAL HOST — the legacy-domain 301 layer.
 *
 * Financial Rails is served from exactly one origin. Every other domain the
 * institution owns resolves to the same deployment, so the redirect has to
 * happen in the request path rather than in DNS: DNS can point a name at this
 * app, but only the app can answer with a 301 and a Location.
 *
 * WHY HERE AND NOT IN vercel.json. The build uses Nitro's Vercel preset, which
 * emits its own .vercel/output/config.json under the Build Output API — a root
 * vercel.json is not merged into it. This runs inside the server entry, which
 * is guaranteed to execute for every request on every host.
 *
 * PATH IS PRESERVED. A legacy URL keeps its path and query, so
 * digitalfinancealliance.com/council lands on financialrails.org/council rather
 * than dumping every inbound link on the homepage. Paths that were renamed in
 * the rebrand are then picked up by the app's own route redirects (/df30 →
 * /fr30, /forums/financial-rails-mena → /forums/mena, and so on), so a deep
 * legacy link resolves in two hops and never 404s.
 *
 * The summit domain is the one exception: it names an event, not the
 * institution, so its bare root goes to the flagship edition. Its deeper paths
 * still map path-for-path.
 */

/** The one origin the platform serves from. */
export const CANONICAL_ORIGIN = "https://financialrails.org";

/** Hosts that must 301 to the canonical origin, path preserved. */
const LEGACY_HOSTS = new Set([
  "digitalfinancealliance.com",
  "www.digitalfinancealliance.com",
  "digitalfinancealliance.org",
  "www.digitalfinancealliance.org",
  "digitalassetsaccord.org",
  "www.digitalassetsaccord.org",
]);

/** The summit domain, whose root names an edition rather than the institution. */
const SUMMIT_HOSTS = new Set(["financialrailssummit.com", "www.financialrailssummit.com"]);

/** Where financialrailssummit.com/ lands. */
const SUMMIT_TARGET = "/forums/mena";

/**
 * The www form of the canonical domain. The apex IS canonical, so www folds
 * into it — never the other way round, which would loop against
 * CANONICAL_ORIGIN.
 */
const WWW_HOST = "www.financialrails.org";

/**
 * Returns a 301 for any request arriving on a non-canonical host, or null when
 * the request is already on the canonical origin and should be served.
 *
 * Localhost and preview deployments are deliberately exempt: a preview URL is
 * not a legacy domain, and redirecting it would make every preview unusable.
 */
export function redirectToCanonicalHost(request: Request): Response | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  const host = url.host.toLowerCase();

  if (SUMMIT_HOSTS.has(host)) {
    const path = url.pathname === "/" ? SUMMIT_TARGET : url.pathname;
    return permanent(`${CANONICAL_ORIGIN}${path}${url.search}`);
  }

  if (LEGACY_HOSTS.has(host) || host === WWW_HOST) {
    return permanent(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`);
  }

  return null;
}

function permanent(location: string): Response {
  return new Response(null, {
    status: 301,
    headers: {
      location,
      // A permanent redirect that search engines and browsers may cache, but
      // not so long that a domain decision becomes irreversible.
      "cache-control": "public, max-age=3600",
    },
  });
}
