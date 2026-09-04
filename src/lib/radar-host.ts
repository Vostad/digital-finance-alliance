/**
 * RAILS RADAR ON ITS OWN DOMAIN — one codebase, two public origins.
 *
 * Radar is served from railsradar.com. The rest of the platform stays on
 * financialrails.org. They are the same application, the same route tree and
 * the same deployment; only the origin and the visible path differ.
 *
 * THE PATH IS REWRITTEN, NOT MOVED. Route files remain `radar.*`, so the
 * router's internal href for the corridor index is `/radar/corridors`. On
 * railsradar.com the public href is `/corridors` — the domain already says
 * "radar", and repeating it in the path would be noise. The mapping is a
 * TanStack Router `rewrite` pair, which matters because it runs in BOTH
 * directions and in BOTH environments:
 *
 *   input   what the browser asks for  ->  what the router matches
 *           railsradar.com/corridors   ->  /radar/corridors
 *   output  what the router links to   ->  what the browser is shown
 *           /radar/corridors           ->  /corridors
 *
 * A server-side rewrite alone would not do. The client router builds its own
 * location from `window.location`, so it would look for `/corridors`, find no
 * such route, and 404 the moment anyone navigated. `output` is what keeps
 * `<Link to="/radar/...">` rendering the short URL, which is why every Radar
 * link must be a `<Link>` and not a bare `<a href>` — an anchor bypasses this
 * entirely and would emit a path that only exists on the other domain.
 *
 * CANONICALS ALWAYS POINT AT railsradar.com. It is the indexed home; the
 * financialrails.org/radar/* paths 301 to it and are not a second surface.
 */

/** The origin Radar is published on, and the only one its canonicals name. */
export const RADAR_ORIGIN = "https://railsradar.com";
export const PLATFORM_ORIGIN = "https://financialrails.org";

/** The internal prefix every Radar route still carries in the route tree. */
export const RADAR_PREFIX = "/radar";

const RADAR_HOSTS = new Set(["railsradar.com", "www.railsradar.com"]);

/** True for the Radar domain, and for its local stand-ins during development. */
export function isRadarHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const h = hostname.toLowerCase().split(":")[0]!;
  return RADAR_HOSTS.has(h) || h === "radar.localhost";
}

/**
 * The public URL for an internal Radar path. `/radar/corridors/x` becomes
 * `https://railsradar.com/corridors/x`. Used for canonical tags, og:url and
 * the sitemap, all of which must name the indexed origin rather than whichever
 * host happened to serve the request.
 */
export function radarUrl(internalPath: string): string {
  return `${RADAR_ORIGIN}${stripRadarPrefix(internalPath)}`;
}

/** `/radar/corridors/x` -> `/corridors/x`, `/radar` -> `/`. */
export function stripRadarPrefix(pathname: string): string {
  if (pathname === RADAR_PREFIX) return "/";
  if (pathname.startsWith(`${RADAR_PREFIX}/`)) return pathname.slice(RADAR_PREFIX.length) || "/";
  return pathname;
}

/** `/corridors/x` -> `/radar/corridors/x`, `/` -> `/radar`. */
export function addRadarPrefix(pathname: string): string {
  if (pathname === "/" || pathname === "") return RADAR_PREFIX;
  if (pathname === RADAR_PREFIX || pathname.startsWith(`${RADAR_PREFIX}/`)) return pathname;
  return `${RADAR_PREFIX}${pathname}`;
}

/**
 * THE ROUTER REWRITE. Host-conditional, so financialrails.org is untouched by
 * it — on that origin both functions return the URL exactly as given, and every
 * existing route keeps behaving as it always has.
 */
export const radarRewrite = {
  input: ({ url }: { url: URL }): URL => {
    if (!isRadarHost(url.hostname)) return url;
    const next = new URL(url);
    next.pathname = addRadarPrefix(url.pathname);
    return next;
  },
  output: ({ url }: { url: URL }): URL => {
    if (!isRadarHost(url.hostname)) return url;
    const next = new URL(url);
    next.pathname = stripRadarPrefix(url.pathname);
    return next;
  },
};

/**
 * WHAT railsradar.com IS ALLOWED TO SERVE — the whole scoping rule.
 *
 * Judged on the PUBLIC path, against a named list of Radar's own top-level
 * segments. An earlier version tested the internal path instead and was dead
 * code: the input rewrite puts `/radar` in front of everything on this host, so
 * "does it start with /radar" was always true and nothing was ever scoped out.
 * The rendered `/contact` link in the Radar shell is what exposed it.
 *
 * Everything not listed belongs to the platform — the forums, the institutional
 * pages, and the admin. Radar's admin is deliberately among them: it stays at
 * financialrails.org/admin/radar behind the one existing login, and is not
 * given a second front door on a public product domain.
 */
const RADAR_SEGMENTS = new Set(["corridors", "providers", "rails", "privacy"]);

/** Served by the app itself. robots.txt and sitemap.xml are answered earlier,
    in the server entry, and never reach the router. */
export function isRadarPublicPath(publicPathname: string): boolean {
  if (publicPathname === "/" || publicPathname === "") return true;
  const first = publicPathname.split("/").filter(Boolean)[0];
  return first !== undefined && RADAR_SEGMENTS.has(first);
}
