import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Intel became Intelligence when the platform became Financial Rails.
 *
 * The URL survives so existing inbound links keep resolving; the publication
 * lives at /intelligence.
 */
export const Route = createFileRoute("/intel")({
  beforeLoad: () => {
    throw redirect({ to: "/intelligence", replace: true });
  },
});
