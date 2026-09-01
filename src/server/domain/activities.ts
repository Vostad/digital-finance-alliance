/**
 * ACTIVITY AND NEXT ACTIONS — §8.
 *
 * The timeline is APPEND-ONLY. There is no update path and no delete path in
 * this module, and that is the whole design: "activity history cannot be
 * silently deleted" is only true if the code offers no way to do it. A
 * correction is a new entry, the same way a ledger is corrected.
 *
 * `occurred_at` is separate from `created_at` on purpose — you log yesterday's
 * call today, and a timeline that pretends it happened at the moment of typing
 * makes response-time metrics meaningless.
 */

import { and, asc, desc, eq, gte, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";

import { activities, companies, editions, opportunities, people, users } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext } from "../auth/permissions";
import { canLogActivity } from "../auth/permissions";
import { forbidden } from "../auth/context";
import { recordAudit } from "./audit";
import { ValidationError, loadForWrite } from "./opportunities";

export const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "follow_up",
  "note",
  "proposal",
  "status_change",
  "assignment",
  "other",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Types a person may log by hand. `status_change` and `assignment` are
    written by the system as a side effect of the real action, and letting
    someone hand-write one would let them fabricate a history. */
export const LOGGABLE_TYPES = ACTIVITY_TYPES.filter(
  (t) => t !== "status_change" && t !== "assignment",
);

export type LogActivityInput = {
  opportunityId: string;
  type: ActivityType;
  notes?: string | null;
  occurredAt?: Date | null;
  /** Setting the next action in the same interaction is the point — §8 pairs
      "what happened" with "what happens next". */
  nextAction?: string | null;
  nextActionDueAt?: Date | null;
};

export async function logActivity(
  q: ScopedQuery,
  input: LogActivityInput,
  ctx: AuthContext,
): Promise<{ id: string }> {
  if (!LOGGABLE_TYPES.includes(input.type as (typeof LOGGABLE_TYPES)[number])) {
    throw new ValidationError(
      `"${input.type}" is recorded by the system when the action happens; it cannot be logged by hand.`,
    );
  }

  const opportunity = await loadForWrite(q, input.opportunityId, ctx);
  if (!canLogActivity(ctx, opportunity)) throw forbidden("You cannot log activity on this record.");

  const occurredAt = input.occurredAt ?? new Date();
  if (occurredAt.getTime() > Date.now() + 60_000) {
    throw new ValidationError("An activity cannot be recorded as having happened in the future.");
  }

  return q.directory.transaction(async (tx) => {
    const [row] = await tx
      .insert(activities)
      .values({
        opportunityId: input.opportunityId,
        userId: ctx.userId,
        type: input.type,
        occurredAt,
        notes: input.notes?.trim() || null,
        createdBy: ctx.userId,
      })
      .returning({ id: activities.id });

    /* Pairing the log with the next action in one transaction is what keeps
       the follow-up queue honest: you cannot record a call and forget to say
       what happens next in two separate half-completed steps. */
    if (input.nextAction !== undefined || input.nextActionDueAt !== undefined) {
      await tx
        .update(opportunities)
        .set({
          nextAction: input.nextAction ?? null,
          nextActionDueAt: input.nextActionDueAt ?? null,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(opportunities.id, input.opportunityId));
    }

    return { id: row!.id };
  });
}

export async function setNextAction(
  q: ScopedQuery,
  opportunityId: string,
  input: { nextAction: string | null; nextActionDueAt: Date | null },
  ctx: AuthContext,
) {
  const current = await loadForWrite(q, opportunityId, ctx);
  if (!canLogActivity(ctx, current)) throw forbidden("You cannot edit this record.");

  return q.directory.transaction(async (tx) => {
    await tx
      .update(opportunities)
      .set({
        nextAction: input.nextAction,
        nextActionDueAt: input.nextActionDueAt,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(opportunities.id, opportunityId));

    await recordAudit(tx, {
      ctx,
      entityType: "opportunity",
      entityId: opportunityId,
      action: "updated",
      after: { nextAction: input.nextAction, nextActionDueAt: input.nextActionDueAt },
    });
    return { ok: true };
  });
}

/** The timeline for one workstream, newest first. Scope is applied through
    `q.where.activities()`, which inherits the opportunity's visibility. */
export async function timeline(q: ScopedQuery, opportunityId: string, limit = 100) {
  return q.directory
    .select({
      id: activities.id,
      type: activities.type,
      occurredAt: activities.occurredAt,
      createdAt: activities.createdAt,
      notes: activities.notes,
      /* Typed rather than `unknown`: jsonb reaches TypeScript as unknown, and
         an unknown cannot cross the RPC boundary's serialisation check. The
         shape is ours — status_change and assignment both write {from, to}. */
      metadata: sql<{ from?: string | null; to?: string | null } | null>`${activities.metadata}`,
      userId: activities.userId,
      userName: users.fullName,
    })
    .from(activities)
    .leftJoin(users, eq(users.id, activities.userId))
    .where(q.where.activities(eq(activities.opportunityId, opportunityId)))
    .orderBy(desc(activities.occurredAt))
    .limit(limit);
}

/* ------------------------------------------------------- the follow-up queue */

export type DueBucket = "overdue" | "today" | "upcoming";

const startOfDayUtc = (offsetDays = 0) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
};

/**
 * §8 — overdue, due today, upcoming.
 *
 * Bucketed in SQL against UTC day boundaries. Timezone rendering is the UI's
 * job; what must not happen is the boundary moving depending on which server
 * answered the request.
 */
export async function followUps(
  q: ScopedQuery,
  opts: {
    ownerId?: string | null | undefined;
    editionId?: string | null | undefined;
    horizonDays?: number | undefined;
  } = {},
) {
  const todayStart = startOfDayUtc(0);
  const tomorrowStart = startOfDayUtc(1);
  const horizonEnd = startOfDayUtc(opts.horizonDays ?? 14);

  const filters = [
    isNotNull(opportunities.nextActionDueAt),
    isNull(opportunities.archivedAt),
    /* Closed work has no follow-up. Anything terminal is excluded by the
       stage's own flags rather than by a hardcoded list of stage keys. */
    sql`exists (
      select 1 from pipeline_stages ps
      where ps.function = ${opportunities.function}
        and ps.key = ${opportunities.stageKey}
        and ps.is_open
    )`,
    lt(opportunities.nextActionDueAt, horizonEnd),
  ];
  if (opts.ownerId) filters.push(eq(opportunities.ownerId, opts.ownerId));
  if (opts.editionId) filters.push(eq(opportunities.editionId, opts.editionId));

  const rows = await q.directory
    .select({
      id: opportunities.id,
      function: opportunities.function,
      stageKey: opportunities.stageKey,
      nextAction: opportunities.nextAction,
      nextActionDueAt: opportunities.nextActionDueAt,
      estimatedValue: opportunities.estimatedValue,
      currency: opportunities.currency,
      ownerId: opportunities.ownerId,
      ownerName: users.fullName,
      personName: people.fullName,
      companyName: companies.name,
      editionName: editions.name,
      /* ISO strings with an explicit cast. A raw sql template has no column
         to infer a type from, so a JS Date reaches the driver as an object it
         cannot serialise — the typed comparisons below are fine because the
         column tells the driver what it is. */
      bucket: sql<DueBucket>`case
        when ${opportunities.nextActionDueAt} < ${todayStart.toISOString()}::timestamptz then 'overdue'
        when ${opportunities.nextActionDueAt} < ${tomorrowStart.toISOString()}::timestamptz then 'today'
        else 'upcoming' end`,
    })
    .from(opportunities)
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(q.where.opportunities(and(...filters)))
    .orderBy(asc(opportunities.nextActionDueAt))
    .limit(300);

  return {
    overdue: rows.filter((r) => r.bucket === "overdue"),
    today: rows.filter((r) => r.bucket === "today"),
    upcoming: rows.filter((r) => r.bucket === "upcoming"),
  };
}

/**
 * §12/§21 — open work with no follow-up at all, and open work that has gone
 * quiet. Both are deterministic queries over real records; neither invents a
 * threshold the data cannot support.
 */
export async function attentionNeeded(
  q: ScopedQuery,
  opts: { ownerId?: string | null | undefined; quietDays?: number | undefined } = {},
) {
  const quietSince = new Date(Date.now() - (opts.quietDays ?? 7) * 86_400_000);

  const open = sql`exists (
    select 1 from pipeline_stages ps
    where ps.function = ${opportunities.function}
      and ps.key = ${opportunities.stageKey}
      and ps.is_open
  )`;

  const base = [isNull(opportunities.archivedAt), open];
  if (opts.ownerId) base.push(eq(opportunities.ownerId, opts.ownerId));

  const select = {
    id: opportunities.id,
    function: opportunities.function,
    stageKey: opportunities.stageKey,
    estimatedValue: opportunities.estimatedValue,
    currency: opportunities.currency,
    ownerId: opportunities.ownerId,
    personName: people.fullName,
    companyName: companies.name,
    createdAt: opportunities.createdAt,
    lastActivityAt: sql<Date | null>`(
      select max(a.occurred_at) from activities a where a.opportunity_id = ${opportunities.id}
    )`,
  };

  const [noFollowUp, quiet, neverContacted] = await Promise.all([
    q.directory
      .select(select)
      .from(opportunities)
      .innerJoin(people, eq(people.id, opportunities.personId))
      .leftJoin(companies, eq(companies.id, opportunities.companyId))
      .where(q.where.opportunities(and(...base, isNull(opportunities.nextActionDueAt))))
      .limit(100),

    q.directory
      .select(select)
      .from(opportunities)
      .innerJoin(people, eq(people.id, opportunities.personId))
      .leftJoin(companies, eq(companies.id, opportunities.companyId))
      .where(
        q.where.opportunities(
          and(
            ...base,
            sql`coalesce(
              (select max(a.occurred_at) from activities a where a.opportunity_id = ${opportunities.id}),
              ${opportunities.createdAt}
            ) < ${quietSince.toISOString()}::timestamptz`,
          ),
        ),
      )
      .limit(100),

    q.directory
      .select(select)
      .from(opportunities)
      .innerJoin(people, eq(people.id, opportunities.personId))
      .leftJoin(companies, eq(companies.id, opportunities.companyId))
      .where(
        q.where.opportunities(
          and(
            ...base,
            sql`not exists (
              select 1 from activities a
              where a.opportunity_id = ${opportunities.id}
                and a.type in ('call','email','meeting')
            )`,
          ),
        ),
      )
      .limit(100),
  ]);

  return { noFollowUp, quiet, neverContacted };
}
