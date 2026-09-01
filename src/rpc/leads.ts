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
import {
  mergeCompanies,
  mergePeople,
  possibleDuplicateCompanies,
  possibleDuplicatePeople,
  reverseMerge,
  reversibleMerges,
} from "@/server/domain/directory";
import { listOpportunities, loadForWrite } from "@/server/domain/opportunities";
import { logActivity, timeline } from "@/server/domain/activities";
import { searchDirectory } from "@/server/domain/directory";
import { globalSearch } from "@/server/domain/search";
import {
  loadCancellationReasons,
  loadLossReasons,
  loadWithdrawalReasons,
  stagesFor,
} from "@/server/domain/pipeline";
import { changeStage } from "@/server/domain/opportunities";
import { conversionRates, pipelineBoard } from "@/server/domain/board";
import { assignOwner, assignableUsers, setSplit } from "@/server/domain/assignment";

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

/** §14 — one search box, three permission rules underneath. */
export const search = createServerFn({ method: "POST" })
  .validator(z.object({ term: z.string().max(200) }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return globalSearch(s.q, s.ctx, data.term);
    }),
  );

/** Directory-only search, for the lead form's company and person pickers. */
export const searchPeopleAndCompanies = createServerFn({ method: "POST" })
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
    const [editions, sponsorStages, delegateStages, speakerStages, cancellation, withdrawal] =
      await Promise.all([
        permittedEditions(s.q, s.ctx),
        stagesFor(s.q, "sponsor"),
        stagesFor(s.q, "delegate"),
        stagesFor(s.q, "speaker"),
        loadCancellationReasons(s.q),
        loadWithdrawalReasons(s.q),
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
      withdrawalReasons: withdrawal,
    };
  }),
);

/* --------------------------------------------------------- §4 · the pipeline */

const WORKSTREAM_FILTERS = z.object({
  eventId: z.string().uuid().nullable().optional(),
  editionId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  unassignedOnly: z.boolean().optional(),
  priority: z.enum(["normal", "high"]).nullable().optional(),
  search: z.string().max(200).nullable().optional(),
});

export const board = createServerFn({ method: "POST" })
  .validator(z.object({ function: WORK_FUNCTION, filters: WORKSTREAM_FILTERS.optional() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return pipelineBoard(s.q, data.function, data.filters ?? {});
    }),
  );

export const rates = createServerFn({ method: "POST" })
  .validator(z.object({ function: WORK_FUNCTION, filters: WORKSTREAM_FILTERS.optional() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return conversionRates(s.q, data.function, data.filters ?? {});
    }),
  );

/** Every §4 transition rule is enforced inside `changeStage`, on the server.
    The UI disables what it can; this is what actually stops it. */
export const moveStage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      opportunityId: z.string().uuid(),
      stageKey: z.string().min(1).max(40),
      lossReasonKey: z.string().max(40).nullable().optional(),
      cancellationReasonKey: z.string().max(40).nullable().optional(),
      withdrawalReasonKey: z.string().max(40).nullable().optional(),
      finalValue: z.string().max(20).nullable().optional(),
      probability: z.number().int().min(0).max(100).nullable().optional(),
      note: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      const { opportunityId, ...change } = data;
      return changeStage(s.q, opportunityId, change, s.ctx);
    }),
  );

export const setOwner = createServerFn({ method: "POST" })
  .validator(z.object({ opportunityId: z.string().uuid(), ownerId: z.string().uuid().nullable() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return assignOwner(s.q, data.opportunityId, data.ownerId, s.ctx);
    }),
  );

export const setCommissionSplit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      opportunityId: z.string().uuid(),
      secondaryOwnerId: z.string().uuid().nullable(),
      ownerSplitPct: z.number().int().min(0).max(100),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      const { opportunityId, ...split } = data;
      return setSplit(s.q, opportunityId, split, s.ctx);
    }),
  );

export const owners = createServerFn({ method: "POST" })
  .validator(z.object({ function: WORK_FUNCTION.nullable().optional() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return assignableUsers(s.q, data.function);
    }),
  );

/** One workstream, with everything the detail screen needs, in one round trip.
    Scope is applied by `loadForWrite`, which refuses read and write alike. */
export const workstream = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      const opp = await loadForWrite(s.q, data.id, s.ctx);

      /* Two small groups rather than one fan-out of eight. The reference sets
         are process-cached, so after the first request this is three queries,
         and a screen does not need to open eight connections to draw itself. */
      const [detail, events, others] = await Promise.all([
        listOpportunities(s.q, { personId: opp.personId }, 20),
        timeline(s.q, data.id),
        otherWorkstreams(s.q, opp.personId, data.id),
      ]);
      const [stages, loss, cancellation, withdrawal, assignees] = await Promise.all([
        stagesFor(s.q, opp.function),
        loadLossReasons(s.q, opp.function),
        loadCancellationReasons(s.q),
        loadWithdrawalReasons(s.q),
        assignableUsers(s.q, opp.function),
      ]);
      return {
        opportunity: detail.find((d) => d.id === data.id) ?? null,
        timeline: events,
        otherWorkstreams: others,
        stages,
        lossReasons: loss,
        cancellationReasons: cancellation,
        withdrawalReasons: withdrawal,
        assignees,
        canAssign: s.ctx.role !== "team_member",
      };
    }),
  );

export const logWork = createServerFn({ method: "POST" })
  .validator(
    z.object({
      opportunityId: z.string().uuid(),
      type: z.enum(["call", "email", "meeting", "follow_up", "note", "proposal", "other"]),
      notes: z.string().max(4000).optional(),
      nextAction: z.string().max(400).nullable().optional(),
      nextActionDueAt: z.string().datetime().nullable().optional(),
    }),
  )
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return logActivity(
        s.q,
        {
          opportunityId: data.opportunityId,
          type: data.type,
          notes: data.notes ?? null,
          nextAction: data.nextAction ?? null,
          nextActionDueAt: data.nextActionDueAt ? new Date(data.nextActionDueAt) : null,
        },
        s.ctx,
      );
    }),
  );

/* ------------------------------------------------------- D6 / D7 · duplicates */

/** The review queue D7 requires: collisions the name heuristic surfaced but
    was never allowed to act on. */
export const duplicateQueue = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => {
    const s = await q();
    const [companies, people] = await Promise.all([
      possibleDuplicateCompanies(s.q),
      possibleDuplicatePeople(s.q),
    ]);
    return { companies, people };
  }),
);

export const mergeTwoPeople = createServerFn({ method: "POST" })
  .validator(z.object({ sourceId: z.string().uuid(), targetId: z.string().uuid() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return mergePeople(s.q, data.sourceId, data.targetId, s.ctx);
    }),
  );

export const mergeTwoCompanies = createServerFn({ method: "POST" })
  .validator(z.object({ sourceId: z.string().uuid(), targetId: z.string().uuid() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return mergeCompanies(s.q, data.sourceId, data.targetId, s.ctx);
    }),
  );

/** D6 — the reversal, exposed. A capability described in the spec and absent
    from the API would be exactly the mismatch D6 exists to forbid. */
export const undoMerge = createServerFn({ method: "POST" })
  .validator(z.object({ mergeId: z.string().uuid() }))
  .handler(({ data }) =>
    sealed(async () => {
      const s = await q();
      return reverseMerge(s.q, data.mergeId, s.ctx);
    }),
  );

export const undoableMerges = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => {
    const s = await q();
    return reversibleMerges(s.q);
  }),
);
