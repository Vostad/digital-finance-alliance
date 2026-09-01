import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Financial Rails Summit V2 became Financial Rails MENA.
 *
 * The URL survives so existing inbound links, shared cards and search results
 * keep resolving; the edition itself lives at /forums/mena.
 *
 * Pointed straight at the final route rather than at
 * /forums/financial-rails-mena, which is now itself a redirect — one hop, not
 * two. A redirect chain costs a round trip and dilutes the signal search
 * engines pass along it.
 */
export const Route = createFileRoute("/forums/financial-rails-v2")({
  beforeLoad: () => {
    throw redirect({ to: "/forums/mena", replace: true, statusCode: 301 });
  },
});
