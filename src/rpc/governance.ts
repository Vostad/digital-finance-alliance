/**
 * RPC — audit, export and erasure. §14, §15, §17.
 *
 * Every one of these is Super Admin only, and every check lives in the domain
 * function rather than here. An endpoint that trusted its caller would be one
 * `fetch` away from a Team Member downloading the whole pipeline.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/server/auth/context";
import { scopedQuery } from "@/server/auth/scoped";
import { ValidationError } from "@/server/domain/opportunities";
import {
  auditTrail,
  erasePerson,
  erasureRegister,
  exportCsv,
  historyFor,
} from "@/server/domain/governance";

async function sealed<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (problem) {
    if (problem != null && typeof problem === "object" && "statusCode" in problem) throw problem;
    console.error("[rpc/governance]", problem);
    throw new ValidationError("Something went wrong. Try again.");
  }
}

const session = async () => {
  const ctx = await requireAuth();
  return { ctx, q: scopedQuery(ctx) };
};

export const audit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      entityType: z.string().max(40).nullable().optional(),
      entityId: z.string().uuid().nullable().optional(),
      actorUserId: z.string().uuid().nullable().optional(),
      action: z.string().max(40).nullable().optional(),
      limit: z.number().int().min(1).max(500).nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      return auditTrail(s.q, s.ctx, data);
    }),
  );

export const recordHistory = createServerFn({ method: "POST" })
  .validator(z.object({ entityType: z.string().max(40), entityId: z.string().uuid() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      return historyFor(s.q, data.entityType, data.entityId);
    }),
  );

export const exportData = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kind: z.enum(["opportunities", "people", "companies", "commission"]),
      editionId: z.string().uuid().nullable().optional(),
      function: z.enum(["sponsor", "delegate", "speaker"]).nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      const { kind, ...filters } = data;
      return exportCsv(s.q, s.ctx, kind, filters);
    }),
  );

/** §15 — the one operation that destroys anything. */
export const erase = createServerFn({ method: "POST" })
  .validator(z.object({ personId: z.string().uuid(), reason: z.string().max(500).nullable() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await session();
      return erasePerson(s.q, data.personId, data.reason, s.ctx);
    }),
  );

export const erasures = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => {
    const s = await session();
    return erasureRegister(s.q, s.ctx);
  }),
);
