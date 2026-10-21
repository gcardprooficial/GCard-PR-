import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { initSentry } from "@/lib/sentry";
import { installStaleChunkReload } from "@/lib/stale-chunk";

export const getRouter = () => {
  if (typeof window !== "undefined") {
    initSentry();
    installStaleChunkReload();
  }
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
