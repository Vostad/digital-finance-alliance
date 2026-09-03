import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { redirectToCanonicalHost } from "./lib/canonical-host";

/**
 * The Radar sitemap is generated from database rows, so it cannot be a static
 * file in public/. It is served here, in the same pre-render position as the
 * canonical-host redirect, because this entry is guaranteed to run for every
 * request on every host — and because this version of Start does not expose
 * file-based server routes to hang it off instead.
 */
async function serveRadarSitemap(request: Request): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/radar/sitemap.xml") return null;
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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Legacy and alternate domains 301 to the canonical origin before any
      // rendering work happens. Returns null on the canonical host and on
      // localhost/preview, which fall through to the app untouched.
      const redirect = redirectToCanonicalHost(request);
      if (redirect) return redirect;

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
