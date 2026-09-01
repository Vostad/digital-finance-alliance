/**
 * RPC — leads, workstreams and the directory.
 *
 * Thin wrappers. Every one starts with `requireAuth()`, so there is no
 * unauthenticated path into any of this, and the authorization decision is
 * made inside the domain function on the server — never by which control the
 * browser happened to render.
 *
 * Domain errors carry their own status and a sentence written for the person
 * who hit them. Anything else is logged in full and replaced, because an
 * internal message is written for us, not for them.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/server/auth/context";
import { scopedQuery } from "@/server/auth/scoped";
import { DuplicateError } from "@/server/domain/directory";
import { ValidationError } from "@/server/domain/opportunities";
import {
  createLead,
  otherWorkstreams,
  permittedEditions,
  previewLead,
} from "@/server/domain/leads";
import { listOpportunities } from "@/server/domain/opportunities";
import { searchDirectory } from "@/server/domain/directory";
import { loadCancellationReasons, loadLossReasons, stagesFor } from "@/server/domain/pipeline";

const WORK_FUNCTION = z.enum(["sponsor", "delegate", "speaker"]);

/** Domain errors reach the client; nothing else does. */
async function sealed<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (problem) {
    if (
      problem instanceof DuplicateError ||
      problem instanceof ValidationError ||
      (problem != null && typeof problem === "object" && "statusCode" in problem)
    ) {
      throw problem;
    }
    console.error("[rpc/leads]", problem);
    throw new ValidationError("Something went wrong. Try again.");
  }
}

const q = async () => {
  const ctx = await requireAuth();
  return { ctx, q: scopedQuery(ctx) };
};

/** §5 — duplicate matching runs BEFORE save, as the operator types. */
export const previewDuplicates = createServerFn({ method: "POST" })
  .validator(
    z.object({
      fullName: z.string().max(200).optional(),
      email: z.string().max(320).optional(),
      companyName: z.string().max(200).optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return previewLead(s.q, data);
    }),
  );

export const addLead = createServerFn({ method: "POST" })
  .validator(
    z.object({
      fullName: z.string().min(1).max(200),
      companyName: z.string().max(200).optional(),
      companyId: z.string().uuid().optional(),
      jobTitle: z.string().max(200).optional(),
      email: z.string().max(320).optional(),
      phone: z.string().max(60).optional(),
      country: z.string().max(80).optional(),
      functions: z.array(WORK_FUNCTION).min(1),
      editionId: z.string().uuid(),
      source: z.enum(["website", "manual", "import", "referral", "event", "other"]).optional(),
      notes: z.string().max(4000).optional(),
      estimatedValue: z.string().max(20).optional(),
      currency: z.string().length(3).optional(),
      ownerId: z.string().uuid().nullable().optional(),
      acceptPersonMatchId: z.string().uuid().optional(),
      acceptCompanyMatchId: z.string().uuid().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return createLead(s.q, data, s.ctx);
    }),
  );

export const listWorkstreams = createServerFn({ method: "POST" })
  .validator(
    z.object({
      eventId: z.string().uuid().nullable().optional(),
      editionId: z.string().uuid().nullable().optional(),
      function: WORK_FUNCTION.nullable().optional(),
      ownerId: z.string().uuid().nullable().optional(),
      unassignedOnly: z.boolean().optional(),
      stageKeys: z.array(z.string().max(40)).nullable().optional(),
      openOnly: z.boolean().optional(),
      search: z.string().max(200).nullable().optional(),
      priority: z.enum(["normal", "high"]).nullable().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      const { limit, ...filters } = data;
      return listOpportunities(s.q, filters, limit ?? 200);
    }),
  );

/** §13 — the other workstreams on a person: existence, owner, status. Never
    value, notes or commission. The projection is enforced here. */
export const workstreamsForPerson = createServerFn({ method: "POST" })
  .validator(z.object({ personId: z.string().uuid(), exclude: z.string().uuid().optional() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return otherWorkstreams(s.q, data.personId, data.exclude);
    }),
  );

export const search = createServerFn({ method: "POST" })
  .validator(z.object({ term: z.string().max(200) }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return searchDirectory(s.q, data.term);
    }),
  );

/** Everything the lead form needs to render, in one round trip. */
export const leadFormOptions = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => {
    const s = await q();
    const [editions, sponsorStages, delegateStages, speakerStages, cancellation] =
      await Promise.all([
        permittedEditions(s.q, s.ctx),
        stagesFor(s.q, "sponsor"),
        stagesFor(s.q, "delegate"),
        stagesFor(s.q, "speaker"),
        loadCancellationReasons(s.q),
      ]);
    const [sponsorLoss, delegateLoss, speakerLoss] = await Promise.all([
      loadLossReasons(s.q, "sponsor"),
      loadLossReasons(s.q, "delegate"),
      loadLossReasons(s.q, "speaker"),
    ]);
    return {
      editions,
      /* Only the functions this person may actually work. A Super Admin or
         Admin holds all three; a Team Member holds what was granted. */
      functions:
        s.ctx.role === "team_member"
          ? s.ctx.functions
          : (["sponsor", "delegate", "speaker"] as const),
      stages: { sponsor: sponsorStages, delegate: delegateStages, speaker: speakerStages },
      lossReasons: { sponsor: sponsorLoss, delegate: delegateLoss, speaker: speakerLoss },
      cancellationReasons: cancellation,
    };
  }),
);
