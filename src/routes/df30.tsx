import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * DF30 became FR30 when the platform became Financial Rails.
 *
 * The URL survives so existing inbound links and search results keep
 * resolving; the index itself lives at /fr30.
 */
export const Route = createFileRoute("/df30")({
  beforeLoad: () => {
    throw redirect({ to: "/fr30", replace: true });
  },
});
