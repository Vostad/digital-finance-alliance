/**
 * RPC — targets. §9.
 *
 * Setting a target is Super Admin only, and the check lives in the domain
 * function rather than here: an endpoint that trusted its caller would be one
 * `fetch` away from a Team Member setting their own number.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/server/auth/context";
import { scopedQuery } from "@/server/auth/scoped";
import { ValidationError } from "@/server/domain/opportunities";
import { setTarget, targetProgress, targetableUsers, updateTarget } from "@/server/domain/targets";

const WORK_FUNCTION = z.enum(["sponsor", "delegate", "speaker"]);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

async function sealed<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (problem) {
    if (problem != null && typeof problem === "object" && "statusCode" in problem) throw problem;
    console.error("[rpc/targets]", problem);
    throw new ValidationError("Something went wrong. Try again.");
  }
}

const session = async () => {
  const ctx = await requireAuth();
  return { ctx, q: scopedQuery(ctx) };
};

export const targets = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid().nullable().optional(),
      editionId: z.string().uuid().nullable().optional(),
      function: WORK_FUNCTION.nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      return targetProgress(s.q, s.ctx, data);
    }),
  );

export const createTarget = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      function: WORK_FUNCTION,
      eventId: z.string().uuid().nullable().optional(),
      editionId: z.string().uuid().nullable().optional(),
      targetValue: z.string().min(1).max(20),
      currency: z.string().length(3).nullable().optional(),
      periodStart: DATE,
      periodEnd: DATE,
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      return setTarget(s.q, data, s.ctx);
    }),
  );

export const changeTarget = createServerFn({ method: "POST" })
  .validator(z.object({ targetId: z.string().uuid(), targetValue: z.string().min(1).max(20) }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      return updateTarget(s.q, data.targetId, data.targetValue, s.ctx);
    }),
  );

export const targetOptions = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => {
    const s = await session();
    return { users: await targetableUsers(s.q, s.ctx) };
  }),
);
