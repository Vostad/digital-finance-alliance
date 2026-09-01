/**
 * RPC — dashboards. Read-only, authenticated, scoped.
 *
 * The role never selects a different query here; `scopedQuery` has already
 * confined every figure. It selects which extra sections are worth fetching.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/server/auth/context";
import { scopedQuery } from "@/server/auth/scoped";
import { dashboard, teamStanding } from "@/server/domain/dashboard";
import { ValidationError } from "@/server/domain/opportunities";
import { outboxSummary } from "@/server/domain/email";
import { canManageUsers } from "@/server/auth/permissions";

const WORK_FUNCTION = z.enum(["sponsor", "delegate", "speaker"]);

async function sealed<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (problem) {
    if (problem != null && typeof problem === "object" && "statusCode" in problem) throw problem;
    console.error("[rpc/dashboard]", problem);
    throw new ValidationError("Something went wrong. Try again.");
  }
}

const session = async () => {
  const ctx = await requireAuth();
  return { ctx, q: scopedQuery(ctx) };
};

export const dashboardView = createServerFn({ method: "POST" })
  .validator(
    z.object({
      function: WORK_FUNCTION.nullable().optional(),
      editionId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      return dashboard(s.q, s.ctx, data);
    }),
  );

export const team = createServerFn({ method: "POST" })
  .validator(
    z.object({
      function: WORK_FUNCTION.nullable().optional(),
      editionId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      return teamStanding(s.q, data);
    }),
  );

/** §19 — the open email gap, visible to the person who can close it rather
    than buried in a build log. */
export const emailStatus = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => {
    const s = await session();
    if (!canManageUsers(s.ctx)) return null;
    return outboxSummary(s.q.directory);
  }),
);
