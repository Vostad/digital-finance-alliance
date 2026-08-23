import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * African Money Movement was folded into Financial Rails Africa.
 *
 * The URL survives so existing inbound links, shared cards and search results
 * keep resolving; the edition itself lives at /forums/financial-rails-africa.
 */
export const Route = createFileRoute("/forums/african-money-movement")({
  beforeLoad: () => {
    throw redirect({ to: "/forums/financial-rails-africa", replace: true });
  },
});
