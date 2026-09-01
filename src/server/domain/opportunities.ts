/**
 * OPPORTUNITIES / WORKSTREAMS — §3. The workstream is the unit of work.
 *
 * There is no lead entity. A lead is an opportunity at NEW, which is why
 * "no hidden leads" is achievable at all: there is one table to look in, and
 * the Super Admin inbox is `owner_id IS NULL` — a database property, not a
 * convention some screen has to remember.
 *
 * The same person may carry a sponsor, a delegate and a speaker workstream
 * simultaneously, each with a different owner, and none of that duplicates the
 * person. That is the whole point of separating identity (directory.ts) from
 * work (this file).
 */

import { and, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import {
  activities,
  companies,
  editions,
  events,
  opportunities,
  people,
  users,
} from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext, WorkFunction } from "../auth/permissions";
import { canAssignOpportunity, canReadOpportunity, canWriteOpportunity } from "../auth/permissions";
import { forbidden } from "../auth/context";
import { recordAudit } from "./audit";
import { findStage, stagesFor, transitionError } from "./pipeline";

export class ValidationError extends Error {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/* ------------------------------------------------------------------- create */

type Maybe<T> = T | null | undefined;

export type CreateOpportunityInput = {
  personId: string;
  companyId?: Maybe<string>;
  editionId: string;
  function: WorkFunction;
  ownerId?: Maybe<string>;
  source?: Maybe<"website" | "manual" | "import" | "referral" | "event" | "other">;
  estimatedValue?: Maybe<string>;
  currency?: Maybe<string>;
  priority?: Maybe<"normal" | "high">;
  nextAction?: Maybe<string>;
  nextActionDueAt?: Maybe<Date>;
  notes?: Maybe<string>;
};

/**
 * Open a workstream.
 *
 * Deliberately permits a second workstream for the same person, edition and
 * function when the previous one is CLOSED — §46.3 requires that a cancelled
 * sponsorship not block a fresh attempt. An OPEN duplicate is refused, because
 * that is two people working the same deal without knowing it.
 */
export async function createOpportunity(
  q: ScopedQuery,
  input: CreateOpportunityInput,
  ctx: AuthContext | null,
): Promise<{ id: string }> {
  const stages = await stagesFor(q, input.function);
  const entry = stages.find((s) => s.isOpen);
  if (!entry) throw new ValidationError(`No open entry stage configured for ${input.function}.`);

  const openKeys = stages.filter((s) => s.isOpen).map((s) => s.key);
  const existing = await q.directory
    .select({ id: opportunities.id, stageKey: opportunities.stageKey })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.personId, input.personId),
        eq(opportunities.editionId, input.editionId),
        eq(opportunities.function, input.function),
        inArray(opportunities.stageKey, openKeys),
        isNull(opportunities.archivedAt),
      ),
    )
    .limit(1);

  if (existing.length) {
    throw new ValidationError(
      `This person already has an open ${input.function} workstream for this edition.`,
    );
  }

  return q.directory.transaction(async (tx) => {
    const [row] = await tx
      .insert(opportunities)
      .values({
        personId: input.personId,
        companyId: input.companyId ?? null,
        editionId: input.editionId,
        function: input.function,
        stageKey: entry.key,
        probability: entry.defaultProbability,
        /* NULL is UNASSIGNED and it is meaningful — the Super Admin inbox is
           defined by it. Never default an owner to whoever happened to type. */
        ownerId: input.ownerId ?? null,
        source: input.source ?? "manual",
        priority: input.priority ?? "normal",
        estimatedValue: input.estimatedValue ?? null,
        currency: input.currency ?? "USD",
        nextAction: input.nextAction ?? null,
        nextActionDueAt: input.nextActionDueAt ?? null,
        createdBy: ctx?.userId ?? null,
        updatedBy: ctx?.userId ?? null,
      })
      .returning({ id: opportunities.id });

    const id = row!.id;

    if (input.notes?.trim()) {
      await tx.insert(activities).values({
        opportunityId: id,
        userId: ctx?.userId ?? null,
        type: "note",
        notes: input.notes.trim(),
        createdBy: ctx?.userId ?? null,
      });
    }

    await recordAudit(tx, {
      ctx,
      entityType: "opportunity",
      entityId: id,
      action: "created",
      after: {
        function: input.function,
        editionId: input.editionId,
        stageKey: entry.key,
        ownerId: input.ownerId ?? null,
        source: input.source ?? "manual",
      },
    });

    return { id };
  });
}

/* -------------------------------------------------------------- stage change */

export type StageChangeInput = {
  stageKey: string;
  lossReasonKey?: Maybe<string>;
  cancellationReasonKey?: Maybe<string>;
  /** D4 — required when moving to WITHDRAWN. Not a loss reason. */
  withdrawalReasonKey?: Maybe<string>;
  finalValue?: Maybe<string>;
  probability?: Maybe<number>;
  note?: Maybe<string>;
};

/**
 * Move a workstream. Every rule §4 and §46.3 state is enforced here, on the
 * server, before the database sees the write — so the operator gets a sentence
 * they can act on rather than a constraint violation.
 *
 * The CHECK constraints behind this are not redundant. They are what holds if
 * a future code path forgets to come through this function.
 */
export async function changeStage(
  q: ScopedQuery,
  opportunityId: string,
  input: StageChangeInput,
  ctx: AuthContext,
): Promise<{ id: string; stageKey: string; cancelledCommission: boolean }> {
  const current = await loadForWrite(q, opportunityId, ctx);

  const from = await findStage(q, current.function, current.stageKey);
  const to = await findStage(q, current.function, input.stageKey);
  if (!to) {
    throw new ValidationError(`"${input.stageKey}" is not a stage for ${current.function}.`);
  }

  const blocked = transitionError(current.function, from, to);
  if (blocked) throw new ValidationError(blocked);

  /* §4 — a WON sponsor deal must carry its final value. Asked for here so the
     UI can require it in the same interaction rather than failing after. */
  if (to.isWon && current.function === "sponsor") {
    const finalValue = input.finalValue ?? current.finalValue;
    if (!finalValue || Number(finalValue) <= 0) {
      throw new ValidationError(
        "A won sponsor opportunity needs its final contracted value — it is the commission base and the closed-revenue figure.",
      );
    }
  }

  if (to.isLost && !input.lossReasonKey && !current.lossReasonKey) {
    throw new ValidationError("A lost opportunity needs a reason.");
  }

  if (to.isCancelled && !input.cancellationReasonKey) {
    throw new ValidationError("A cancelled opportunity needs a cancellation reason.");
  }

  /* D4 — a withdrawal states why, in its own vocabulary. Asked for here so the
     operator gets a sentence rather than a constraint violation. */
  if (to.isAttrition && !input.withdrawalReasonKey) {
    throw new ValidationError("A withdrawal needs a reason.");
  }

  const now = new Date();
  const overridden = input.probability != null && input.probability !== to.defaultProbability;

  return q.directory.transaction(async (tx) => {
    const patch: Record<string, unknown> = {
      stageKey: to.key,
      probability: input.probability ?? to.defaultProbability,
      probabilityOverridden: overridden,
      updatedAt: now,
      updatedBy: ctx.userId,
    };

    if (to.isWon) {
      patch["wonAt"] = current.wonAt ?? now;
      if (input.finalValue) patch["finalValue"] = input.finalValue;
    }
    if (to.isLost) {
      patch["lostAt"] = now;
      patch["lossReasonKey"] = input.lossReasonKey ?? current.lossReasonKey;
    }
    if (to.isCancelled) {
      patch["cancelledAt"] = now;
      patch["cancellationReasonKey"] = input.cancellationReasonKey;
    }
    if (to.isAttrition) {
      patch["withdrawalReasonKey"] = input.withdrawalReasonKey;
    }
    /* Moving back into an open stage clears the terminal marks, so a
       reopened deal does not carry a stale loss reason into reporting. */
    if (to.isOpen) {
      patch["lossReasonKey"] = null;
      patch["lostAt"] = null;
    }

    await tx.update(opportunities).set(patch).where(eq(opportunities.id, opportunityId));

    await tx.insert(activities).values({
      opportunityId,
      userId: ctx.userId,
      type: "status_change",
      notes: input.note?.trim() || null,
      metadata: { from: current.stageKey, to: to.key },
      createdBy: ctx.userId,
    });

    await recordAudit(tx, {
      ctx,
      entityType: "opportunity",
      entityId: opportunityId,
      action: to.isWon
        ? "won"
        : to.isLost
          ? "lost"
          : to.isCancelled
            ? "cancelled"
            : "stage_changed",
      before: { stageKey: current.stageKey },
      after: {
        stageKey: to.key,
        lossReasonKey: input.lossReasonKey ?? null,
        cancellationReasonKey: input.cancellationReasonKey ?? null,
        withdrawalReasonKey: input.withdrawalReasonKey ?? null,
        finalValue: input.finalValue ?? current.finalValue,
      },
    });

    return { id: opportunityId, stageKey: to.key, cancelledCommission: to.isCancelled };
  });
}

/* ------------------------------------------------------------------ reading */

export type OpportunityRow = {
  id: string;
  function: WorkFunction;
  stageKey: string;
  ownerId: string | null;
  secondaryOwnerId: string | null;
  editionId: string;
  eventId: string;
  personId: string;
  companyId: string | null;
  finalValue: string | null;
  estimatedValue: string | null;
  currency: string;
  probability: number;
  lossReasonKey: string | null;
  wonAt: Date | null;
};

/**
 * Load a row for a write and prove the caller may perform it.
 *
 * Two separate checks, because visible is not writable: an unassigned lead is
 * visible to a scoped Admin and writable by nobody below Super Admin until it
 * is assigned.
 */
export async function loadForWrite(
  q: ScopedQuery,
  opportunityId: string,
  ctx: AuthContext,
): Promise<OpportunityRow> {
  const rows = await q.directory
    .select({
      id: opportunities.id,
      function: opportunities.function,
      stageKey: opportunities.stageKey,
      ownerId: opportunities.ownerId,
      secondaryOwnerId: opportunities.secondaryOwnerId,
      editionId: opportunities.editionId,
      eventId: editions.eventId,
      personId: opportunities.personId,
      companyId: opportunities.companyId,
      finalValue: opportunities.finalValue,
      estimatedValue: opportunities.estimatedValue,
      currency: opportunities.currency,
      probability: opportunities.probability,
      lossReasonKey: opportunities.lossReasonKey,
      wonAt: opportunities.wonAt,
    })
    .from(opportunities)
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .where(eq(opportunities.id, opportunityId))
    .limit(1);

  const row = rows[0];
  /* Not-found and not-permitted answer identically on purpose: distinguishing
     them tells an unauthorised caller which ids exist. */
  if (!row) throw forbidden("You do not have access to this record.");
  const subject = { ...row, function: row.function as WorkFunction };
  if (!canReadOpportunity(ctx, subject)) throw forbidden("You do not have access to this record.");
  if (!canWriteOpportunity(ctx, subject)) throw forbidden("You cannot edit this record.");
  return subject;
}

export type OpportunityFilters = {
  eventId?: Maybe<string>;
  editionId?: Maybe<string>;
  function?: Maybe<WorkFunction>;
  ownerId?: Maybe<string>;
  unassignedOnly?: Maybe<boolean>;
  stageKeys?: Maybe<string[]>;
  source?: Maybe<string>;
  priority?: Maybe<"normal" | "high">;
  companyId?: Maybe<string>;
  personId?: Maybe<string>;
  country?: Maybe<string>;
  openOnly?: Maybe<boolean>;
  search?: Maybe<string>;
};

/** §14 — every filter composes onto the caller's scope, never replaces it. */
export function opportunityFilterSql(f: OpportunityFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (f.editionId) parts.push(eq(opportunities.editionId, f.editionId));
  if (f.eventId) parts.push(eq(editions.eventId, f.eventId));
  if (f.function) parts.push(eq(opportunities.function, f.function));
  if (f.ownerId) parts.push(eq(opportunities.ownerId, f.ownerId));
  if (f.unassignedOnly) parts.push(isNull(opportunities.ownerId));
  if (f.stageKeys?.length) parts.push(inArray(opportunities.stageKey, f.stageKeys));
  if (f.source) parts.push(sql`${opportunities.source}::text = ${f.source}`);
  if (f.priority) parts.push(sql`${opportunities.priority}::text = ${f.priority}`);
  if (f.companyId) parts.push(eq(opportunities.companyId, f.companyId));
  if (f.personId) parts.push(eq(opportunities.personId, f.personId));
  if (f.country) parts.push(eq(people.country, f.country));
  if (f.search?.trim()) {
    const like = `%${f.search.trim().toLowerCase()}%`;
    parts.push(
      or(sql`lower(${people.fullName}) like ${like}`, sql`lower(${companies.name}) like ${like}`)!,
    );
  }
  parts.push(isNull(opportunities.archivedAt));
  return parts.length ? and(...parts) : undefined;
}

/** The list every board and dashboard reads from. Scope is applied by the
    caller's `scopedQuery`, so an unscoped call is impossible here. */
export async function listOpportunities(
  q: ScopedQuery,
  filters: OpportunityFilters = {},
  limit = 200,
) {
  const rows = await q.directory
    .select({
      id: opportunities.id,
      function: opportunities.function,
      stageKey: opportunities.stageKey,
      priority: opportunities.priority,
      source: opportunities.source,
      estimatedValue: opportunities.estimatedValue,
      finalValue: opportunities.finalValue,
      currency: opportunities.currency,
      probability: opportunities.probability,
      nextAction: opportunities.nextAction,
      nextActionDueAt: opportunities.nextActionDueAt,
      wonAt: opportunities.wonAt,
      createdAt: opportunities.createdAt,
      ownerId: opportunities.ownerId,
      ownerName: users.fullName,
      personId: people.id,
      personName: people.fullName,
      jobTitle: people.jobTitle,
      companyId: companies.id,
      companyName: companies.name,
      country: people.country,
      editionId: editions.id,
      editionName: editions.name,
      eventId: events.id,
      eventName: events.name,
    })
    .from(opportunities)
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(q.where.opportunities(opportunityFilterSql(filters)))
    .orderBy(desc(opportunities.createdAt))
    .limit(limit);

  return rows;
}

/** §15 — renewal. Clone a won sponsorship into a new edition at NEW, leaving
    the historical opportunity untouched. */
export async function cloneIntoEdition(
  q: ScopedQuery,
  opportunityId: string,
  editionId: string,
  ownerId: string | null,
  ctx: AuthContext,
): Promise<{ id: string }> {
  const source = await loadForWrite(q, opportunityId, ctx);
  if (!canAssignOpportunity(ctx, source)) throw forbidden("You cannot start a renewal here.");

  const stages = await stagesFor(q, source.function);
  const entry = stages.find((s) => s.isOpen)!;

  return q.directory.transaction(async (tx) => {
    const [row] = await tx
      .insert(opportunities)
      .values({
        personId: source.personId,
        companyId: source.companyId,
        editionId,
        function: source.function,
        stageKey: entry.key,
        probability: entry.defaultProbability,
        ownerId,
        source: "referral",
        estimatedValue: source.finalValue ?? source.estimatedValue,
        currency: source.currency,
        clonedFromId: source.id,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning({ id: opportunities.id });

    const id = row!.id;
    await recordAudit(tx, {
      ctx,
      entityType: "opportunity",
      entityId: id,
      action: "cloned",
      after: { clonedFromId: source.id, editionId, ownerId },
    });
    return { id };
  });
}
