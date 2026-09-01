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

/* ------------------------------------------------------------ §11 · forecast */

export const forecastView = createServerFn({ method: "POST" })
  .validator(
    z.object({
      editionId: z.string().uuid().nullable().optional(),
      function: WORK_FUNCTION.nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      const { forecast } = await import("@/server/domain/forecast");
      return forecast(s.q, s.ctx, data);
    }),
  );

/** §11 — the override, recorded. Setting it back to the ladder clears the flag
    rather than recording a "manual" value that happens to match. */
export const setProbability = createServerFn({ method: "POST" })
  .validator(
    z.object({
      opportunityId: z.string().uuid(),
      probability: z.number().int().min(0).max(100).nullable(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      const { overrideProbability } = await import("@/server/domain/forecast");
      return overrideProbability(s.q, data.opportunityId, data.probability, s.ctx);
    }),
  );

export const overrides = createServerFn({ method: "POST" })
  .validator(z.object({ function: WORK_FUNCTION.optional() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      const { overriddenOpportunities } = await import("@/server/domain/forecast");
      return overriddenOpportunities(s.q, data.function ?? "sponsor");
    }),
  );

/* --------------------------------------------------- §12 · productivity */

export const productivityMetrics = createServerFn({ method: "POST" })
  .validator(
    z.object({
      function: WORK_FUNCTION,
      editionId: z.string().uuid().nullable().optional(),
      ownerId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      const { metrics } = await import("@/server/domain/productivity");
      const { function: fn, ...filters } = data;
      return metrics(s.q, fn, filters);
    }),
  );

/** Deterministic. No model calls — every insight carries the ids it counted. */
export const productivityInsights = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ownerId: z.string().uuid().nullable().optional(),
      editionId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      const { insights } = await import("@/server/domain/productivity");
      return insights(s.q, s.ctx, data);
    }),
  );
