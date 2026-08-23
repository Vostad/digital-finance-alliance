import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * India Digital Payments & Fintech was folded into Financial Rails Asia.
 *
 * The URL survives so existing inbound links, shared cards and search results
 * keep resolving; the edition itself lives at /forums/financial-rails-asia.
 */
export const Route = createFileRoute("/forums/india-digital-payments")({
  beforeLoad: () => {
    throw redirect({ to: "/forums/financial-rails-asia", replace: true });
  },
});
