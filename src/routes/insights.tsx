import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Insights became Intel, and Intel became Financial Rails Intelligence. This
 * URL survives so the oldest shared links still resolve — one hop, straight to
 * the publication, never through the intermediate name.
 */
export const Route = createFileRoute("/insights")({
  beforeLoad: () => {
    throw redirect({ to: "/intelligence", replace: true });
  },
});
