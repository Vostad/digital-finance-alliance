import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Financial Rails Summit V2 became Financial Rails MENA.
 *
 * The URL survives so existing inbound links, shared cards and search results
 * keep resolving; the edition itself lives at /forums/financial-rails-mena.
 */
export const Route = createFileRoute("/forums/financial-rails-v2")({
  beforeLoad: () => {
    throw redirect({ to: "/forums/financial-rails-mena", replace: true });
  },
});
