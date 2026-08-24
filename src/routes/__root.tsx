import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { ACTIVE_PALETTE } from "../lib/accord-palette";
import { FINANCIAL_RAILS } from "../lib/financial-rails";
import { jsonLd, rootGraph } from "../lib/structured-data";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Nav } from "../components/site/Nav";
import { Footer } from "../components/site/Footer";
import { Action, Arrow } from "../components/site/primitives";

/**
 * The site's own 404, not the scaffold's. This page and the error boundary
 * below were the only two surfaces still drawn in the starter kit's language —
 * rounded fills, `bg-primary`, `text-muted-foreground`, a 7xl sans numeral —
 * none of which exist anywhere else on Financial Rails. They now use the same
 * ground, display type, rule and Action button as every other page, so a
 * visitor who mistypes a URL still lands somewhere that looks like the site.
 */
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-ink">
      <div className="w-full max-w-xl">
        <p className="label accord-signal opacity-60">Error 404</p>
        <h1 className="display-lg mt-8 max-w-[16ch]">This page does not exist.</h1>
        <p className="lede mt-8 max-w-[46ch] border-t border-hairline pt-8 opacity-75">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-12">
          <Action to="/">Return Home</Action>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-ink">
      <div className="w-full max-w-xl">
        <p className="label accord-signal opacity-60">Something went wrong</p>
        <h1 className="display-lg mt-8 max-w-[16ch]">This page didn't load.</h1>
        <p className="lede mt-8 max-w-[46ch] border-t border-hairline pt-8 opacity-75">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {/* "Try again" runs a router action rather than navigating, so it has to
            be a real <button> — Action renders a Link. It carries the Action
            base and `solid` classes verbatim so the pair reads as one system. */}
        <div className="mt-12 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="group label inline-flex items-center gap-4 bg-ink px-7 py-4 text-paper transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent"
          >
            <span>Try Again</span>
            <Arrow />
          </button>
          <Action to="/" variant="outline">
            Return Home
          </Action>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Financial Rails — The Infrastructure of the Next Financial System" },
      { name: "description", content: FINANCIAL_RAILS.seoDescription },
      { name: "author", content: "Financial Rails" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Financial Rails" },
      // twitter:card only. A twitter:title/description here would be the
      // HOMEPAGE'S, and because no child route overrides those two names it
      // would ride along on every page — every share card on the site would
      // read "Financial Rails — The Infrastructure of the Next Financial
      // System" regardless of the page shared. Twitter falls back to og:title
      // and og:description when the twitter:* pair is absent, and every route
      // sets its own og pair, so omitting them here is what makes the cards
      // page-specific.
      { name: "twitter:card", content: "summary_large_image" },
      // Share cards want a 1200x630 image, not a favicon, so this is the
      // official accent mark composed on brand ink at that size. ABSOLUTE, not
      // "/og-image.png": og:image is fetched by crawlers that have no page
      // context to resolve a root-relative path against, so the relative form
      // silently yields no image on Facebook, LinkedIn, Slack and X.
      { property: "og:image", content: `${FINANCIAL_RAILS.origin}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Financial Rails" },
      { property: "og:url", content: FINANCIAL_RAILS.origin },
      { name: "twitter:image", content: `${FINANCIAL_RAILS.origin}/og-image.png` },
      { name: "theme-color", content: "#101223" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // NO canonical here. `links` from the root and from a child route are
      // concatenated, not deduped by `rel` the way `meta` is deduped by
      // name/property — so a canonical at this level emitted a SECOND
      // <link rel="canonical" href="https://financialrails.org"> on every
      // page beneath the home page, alongside that page's own. Two
      // conflicting canonicals is worse than none: Google discards the
      // signal rather than choosing. Every indexable route declares its own.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      // External brand identity ALWAYS carries the accent — the white mark
      // belongs only to the dark interface. Every declaration below resolves to
      // the same accent artwork, so no browser can pick a conflicting icon.
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-192.png", type: "image/png", sizes: "192x192" },
      // Legacy fallback for the automatic /favicon.ico request; same mark.
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // Selects the Financial Rails colour palette for the whole document.
    // See src/lib/accord-palette.ts — one constant switches the system.
    <html lang="en" data-accord-palette={ACTIVE_PALETTE}>
      <head>
        <HeadContent />
        {/* Organisation identity, stated once for the whole site. Only facts
            the platform already publishes — no invented address, no invented
            contact point, no unverifiable claim. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(rootGraph()) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Event micro-sites (/forums/<slug>) carry their own navigation and footer so
  // each reads as its own property. Institutional pages keep the Financial Rails
  // chrome untouched. The standalone-property branch was dropped along with the
  // experimental event routes it served.
  const isEventMicrosite = /^\/forums\/[^/]+\/?$/.test(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      {isEventMicrosite ? null : <Nav />}
      <main>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </main>
      {isEventMicrosite ? null : <Footer />}
    </QueryClientProvider>
  );
}
