import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { radarRewrite } from "./lib/radar-host";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    /* railsradar.com/corridors  <->  /radar/corridors. Host-conditional, so
       financialrails.org is unaffected. Runs on the server AND in the browser,
       which is the only reason client-side navigation works on the new
       origin — see src/lib/radar-host.ts. */
    rewrite: radarRewrite,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
