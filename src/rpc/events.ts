/** THE RPC SURFACE for events. Thin wrappers; every decision is server-side. */

import { createServerFn } from "@tanstack/react-start";

import { AuthError, requireAuth } from "@/server/auth/context";
import { scopedQuery } from "@/server/auth/scoped";
import { eventsOverview } from "@/server/domain/events";

async function sealed<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (problem) {
    if (problem instanceof AuthError) throw problem;
    if (problem != null && typeof problem === "object" && "statusCode" in problem) throw problem;
    console.error("[rpc/events]", problem);
    throw new AuthError("unauthenticated", "Something went wrong. Try again.", 500);
  }
}

export const overview = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => {
    const ctx = await requireAuth();
    return {
      rows: await eventsOverview(scopedQuery(ctx), ctx),
      user: { userId: ctx.userId, fullName: ctx.fullName, role: ctx.role },
    };
  }),
);
