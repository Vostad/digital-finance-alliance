import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { redirectToCanonicalHost } from "./lib/canonical-host";
import {
  PLATFORM_ORIGIN,
  RADAR_ORIGIN,
  isRadarHost,
  isRadarPublicPath,
  stripRadarPrefix,
} from "./lib/radar-host";

/**
 * THE TWO-ORIGIN RULE, applied before anything renders.
 *
 * Radar is published on railsradar.com; everything else on financialrails.org.
 * Both are the same deployment, so the split is enforced here rather than by
 * having two apps — and enforced with 301s, not 404s, because every one of
 * these paths has a correct home on the other origin and a permanent redirect
 * is what tells a crawler which one it is.
 *
 *   financialrails.org/radar/*  ->  railsradar.com/*      the move itself
 *   railsradar.com/<non-radar>  ->  financialrails.org/*  scoping
 *
 * ADMIN IS DELIBERATELY IN THE SECOND CASE. Radar's admin stays at
 * financialrails.org/admin/radar behind the one existing login. A public
 * product domain should not carry a second front door to it.
 *
 * Returns null when the request is already where it belongs.
 */
export function redirectAcrossOrigins(request: Request): Response | null {
  const url = new URL(request.url);
  const host = url.hostname;
  const move = (to: string) =>
    new Response(null, {
      status: 301,
      headers: { location: to, "cache-control": "public, max-age=3600" },
    });

  if (isRadarHost(host)) {
    /* Judged on the PUBLIC path. Reconstructing the internal one first would
       prefix everything with /radar and scope nothing out. */
    if (isRadarPublicPath(url.pathname)) return null;
    return move(`${PLATFORM_ORIGIN}${url.pathname}${url.search}`);
  }

  /* The platform origin no longer serves Radar. Path preserved, prefix dropped:
     /radar/corridors/x -> railsradar.com/corridors/x */
  if (url.pathname === "/radar" || url.pathname.startsWith("/radar/")) {
    return move(`${RADAR_ORIGIN}${stripRadarPrefix(url.pathname)}${url.search}`);
  }
  return null;
}

/**
 * The Radar sitemap is generated from database rows, so it cannot be a static
 * file in public/. It is served here, in the same pre-render position as the
 * canonical-host redirect, because this entry is guaranteed to run for every
 * request on every host — and because this version of Start does not expose
 * file-based server routes to hang it off instead.
 */
async function serveRadarSitemap(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  /* railsradar.com/sitemap.xml is the real one. The old path is still answered
     on the Radar host so a crawler that cached it is not sent in a circle by
     the redirect above. */
  const wanted = isRadarHost(url.hostname)
    ? url.pathname === "/sitemap.xml" || url.pathname === "/radar/sitemap.xml"
    : false;
  if (!wanted) return null;
  try {
    const { radarSitemap } = await import("./server/radar/sitemap");
    return new Response(await radarSitemap(), {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        /* Crawlers re-fetch often; the row set changes rarely. */
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (error) {
    /* A sitemap that 500s teaches a crawler the site is broken. An empty but
       valid one teaches it nothing and costs nothing. */
    console.error("[radar/sitemap]", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',
      { headers: { "content-type": "application/xml; charset=utf-8" } },
    );
  }
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * railsradar.com needs its own robots.txt: the one in public/ names the
 * platform's sitemap and would advertise the wrong origin here.
 */
function serveRadarRobots(request: Request): Response | null {
  const url = new URL(request.url);
  if (!isRadarHost(url.hostname) || url.pathname !== "/robots.txt") return null;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${RADAR_ORIGIN}/sitemap.xml\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Legacy and alternate domains 301 to the canonical origin before any
      // rendering work happens. Returns null on the canonical host and on
      // localhost/preview, which fall through to the app untouched.
      const redirect = redirectToCanonicalHost(request);
      if (redirect) return redirect;

      const crossOrigin = redirectAcrossOrigins(request);
      if (crossOrigin) return crossOrigin;

      const robots = serveRadarRobots(request);
      if (robots) return robots;

      const sitemap = await serveRadarSitemap(request);
      if (sitemap) return sitemap;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
