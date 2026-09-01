import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Financial Rails MENA moved to /forums/mena.
 *
 * THIS REDIRECT IS NOT SPECULATIVE. Before it was written, the live site was
 * checked: https://financialrails.org/forums/financial-rails-mena answered
 * 200 and the URL is listed in the published sitemap, so it is indexed and
 * carries inbound links. Removing it outright would 404 every one of them.
 *
 * The page it used to render is gone — /forums/mena is the one MENA microsite
 * now — so this file keeps the address alive and nothing else.
 *
 * By contrast /forum/dubai-summit, where the new microsite was developed,
 * answered 404 in production and was never merged to main. It has no redirect
 * because it never had an audience.
 */
export const Route = createFileRoute("/forums/financial-rails-mena")({
  beforeLoad: () => {
    throw redirect({ to: "/forums/mena", replace: true, statusCode: 301 });
  },
});
