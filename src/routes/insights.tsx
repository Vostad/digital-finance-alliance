import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Insights became Intel. This URL survives only so that the global
 * navigation, footer and any shared links keep working — the publication
 * lives at /intel.
 */
export const Route = createFileRoute("/insights")({
  beforeLoad: () => {
    throw redirect({ to: "/intel", replace: true });
  },
});
