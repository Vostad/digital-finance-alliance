/**
 * TARGETS — §9.
 *
 * A target is always attached to a person. There is no faceless "event target"
 * that nobody owns: a number with no name against it is a wish, and the roll-up
 * to an event total is a SUM of the people who are actually accountable for it.
 *
 * ACHIEVEMENT IS THE §4 RULE, and it is stated here once:
 *
 *   won_at IS NOT NULL   AND   not cancelled   AND   current stage is not attrition
 *
 * Sponsor targets are money and measure `final_value`. Delegate and speaker
 * targets are counts. Delegate ATTENDED and speaker WITHDRAWN are reported
 * BESIDE the target as their own numbers (D2, D4) and never folded into it.
 */

import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import { editions, events, opportunities, targets, users } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext, WorkFunction } from "../auth/permissions";
import { canManageUsers } from "../auth/permissions";
import { forbidden } from "../auth/context";
import { recordAudit } from "./audit";
import { ValidationError } from "./opportunities";

type Maybe<T> = T | null | undefined;

export type SetTargetInput = {
  userId: string;
  function: WorkFunction;
  eventId?: Maybe<string>;
  editionId?: Maybe<string>;
  targetValue: string;
  currency?: Maybe<string>;
  periodStart: string;
  periodEnd: string;
};

/** Sponsor is priced. Delegate and speaker are counted. Not a preference —
    §4 says delegate and speaker carry no money at all. */
export function metricFor(fn: WorkFunction): "revenue" | "count" {
  return fn === "sponsor" ? "revenue" : "count";
}

/**
 * §9 — Super Admin sets targets. Only.
 *
 * An Admin who could set their own team's targets could also set them low,
 * which makes every progress figure in the system unfalsifiable.
 */
export async function setTarget(
  q: ScopedQuery,
  input: SetTargetInput,
  ctx: AuthContext,
): Promise<{ id: string }> {
  if (!canManageUsers(ctx)) throw forbidden("Only a Super Admin can set targets.");

  const value = Number(input.targetValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError("A target needs a positive number.");
  }
  if (new Date(input.periodEnd) < new Date(input.periodStart)) {
    throw new ValidationError("The period ends before it starts.");
  }
  if (!input.eventId && !input.editionId) {
    throw new ValidationError("A target must name an event or an edition.");
  }

  const metric = metricFor(input.function);
  /* The database enforces this too — a revenue target with no currency is a
     number with no unit. Asked for here so the message is readable. */
  const currency = metric === "revenue" ? (input.currency ?? "USD") : null;

  return q.directory.transaction(async (tx) => {
    const [row] = await tx
      .insert(targets)
      .values({
        userId: input.userId,
        function: input.function,
        eventId: input.eventId ?? null,
        editionId: input.editionId ?? null,
        metric,
        targetValue: input.targetValue,
        currency,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning({ id: targets.id });

    await recordAudit(tx, {
      ctx,
      entityType: "target",
      entityId: row!.id,
      action: "created",
      after: {
        userId: input.userId,
        function: input.function,
        metric,
        targetValue: input.targetValue,
        editionId: input.editionId ?? null,
      },
    });
    return { id: row!.id };
  });
}

export async function updateTarget(
  q: ScopedQuery,
  targetId: string,
  targetValue: string,
  ctx: AuthContext,
): Promise<{ id: string }> {
  if (!canManageUsers(ctx)) throw forbidden("Only a Super Admin can change targets.");
  const value = Number(targetValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError("A target needs a positive number.");
  }

  return q.directory.transaction(async (tx) => {
    const before = await tx
      .select({ targetValue: targets.targetValue })
      .from(targets)
      .where(eq(targets.id, targetId))
      .limit(1);
    if (!before[0]) throw new ValidationError("That target does not exist.");

    await tx
      .update(targets)
      .set({ targetValue, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(eq(targets.id, targetId));

    /* §17 — target changes are audited. Moving a target is how a miss becomes
       a hit on paper, so the previous value must survive. */
    await recordAudit(tx, {
      ctx,
      entityType: "target",
      entityId: targetId,
      action: "target_changed",
      before: { targetValue: before[0].targetValue },
      after: { targetValue },
    });
    return { id: targetId };
  });
}

/* ------------------------------------------------------------------ progress */

export type TargetProgress = {
  id: string;
  userId: string;
  userName: string;
  function: WorkFunction;
  metric: "revenue" | "count";
  editionId: string | null;
  editionName: string | null;
  eventName: string | null;
  periodStart: string;
  periodEnd: string;
  currency: string | null;
  target: number;
  achieved: number;
  remaining: number;
  /** Open work: money for sponsor, a count otherwise. */
  pipeline: number;
  /** achieved + weighted open pipeline. Labelled FORECAST, never committed. */
  forecast: number;
  /** null when the target is zero — a percentage of nothing is not 0%. */
  progressPct: number | null;
  /** D2 / D4 — reported beside the target, never inside it. */
  attended: number;
  withdrawn: number;
};

/**
 * Targets the caller may see, each with its progress computed from live rows.
 *
 * §9 — a Team Member sees only their own, and only for functions they hold.
 * Both halves matter: their own, because another person's number is not
 * theirs to read; and only permitted functions, because a sponsor target on a
 * delegate-only member is not a target they can act on.
 */
export async function targetProgress(
  q: ScopedQuery,
  ctx: AuthContext,
  filters: {
    userId?: Maybe<string>;
    editionId?: Maybe<string>;
    function?: Maybe<WorkFunction>;
  } = {},
): Promise<TargetProgress[]> {
  const where = [];

  if (ctx.role === "team_member") {
    where.push(eq(targets.userId, ctx.userId));
    where.push(
      sql`${targets.function}::text = any(${sql.raw(`array[${ctx.functions.map((f) => `'${f}'`).join(",") || "''"}]::text[]`)})`,
    );
  } else if (filters.userId) {
    where.push(eq(targets.userId, filters.userId));
  }

  /* An Admin sees targets for their scoped events only. Unlike opportunities,
     targets carry the event directly, so the scope is applied here rather than
     through q.where — there is no opportunity row to filter through. */
  if (ctx.role === "admin") {
    if (!ctx.eventScopeIds.length) return [];
    const ids = ctx.eventScopeIds.map((id) => `'${id}'::uuid`).join(",");
    where.push(
      sql`(${targets.eventId} = any(array[${sql.raw(ids)}])
        or ${targets.editionId} in (select id from editions where event_id = any(array[${sql.raw(ids)}])))`,
    );
  }

  if (filters.editionId) where.push(eq(targets.editionId, filters.editionId));
  if (filters.function) where.push(eq(targets.function, filters.function));

  const rows = await q.directory
    .select({
      id: targets.id,
      userId: targets.userId,
      userName: users.fullName,
      function: targets.function,
      metric: targets.metric,
      editionId: targets.editionId,
      editionName: editions.name,
      eventName: events.name,
      periodStart: targets.periodStart,
      periodEnd: targets.periodEnd,
      currency: targets.currency,
      targetValue: targets.targetValue,

      /* Everything below is measured against the SAME window and owner the
         target names, so the numbers beside a target always describe it. */
      achieved: sql<string>`coalesce((
        select case when ${targets.metric} = 'revenue'
                    then sum(o.final_value)
                    else count(*) end
        from opportunities o
        join pipeline_stages ps on ps.function = o.function and ps.key = o.stage_key
        where o.owner_id = ${targets.userId}
          and o.function = ${targets.function}
          and o.won_at is not null
          and o.cancelled_at is null
          and not ps.is_attrition
          and (${targets.editionId} is null or o.edition_id = ${targets.editionId})
          and o.won_at::date between ${targets.periodStart} and ${targets.periodEnd}
      ), 0)`,

      pipeline: sql<string>`coalesce((
        select case when ${targets.metric} = 'revenue'
                    then sum(o.estimated_value)
                    else count(*) end
        from opportunities o
        join pipeline_stages ps on ps.function = o.function and ps.key = o.stage_key
        where o.owner_id = ${targets.userId}
          and o.function = ${targets.function}
          and ps.is_open
          and o.archived_at is null
          and (${targets.editionId} is null or o.edition_id = ${targets.editionId})
      ), 0)`,

      weighted: sql<string>`coalesce((
        select case when ${targets.metric} = 'revenue'
                    then sum(coalesce(o.estimated_value,0) * o.probability / 100.0)
                    else sum(o.probability / 100.0) end
        from opportunities o
        join pipeline_stages ps on ps.function = o.function and ps.key = o.stage_key
        where o.owner_id = ${targets.userId}
          and o.function = ${targets.function}
          and ps.is_open
          and o.archived_at is null
          and (${targets.editionId} is null or o.edition_id = ${targets.editionId})
      ), 0)`,

      attended: sql<number>`coalesce((
        select count(*)::int from opportunities o
        join pipeline_stages ps on ps.function = o.function and ps.key = o.stage_key
        where o.owner_id = ${targets.userId} and o.function = ${targets.function} and ps.is_attendance
          and (${targets.editionId} is null or o.edition_id = ${targets.editionId})
      ), 0)`,

      withdrawn: sql<number>`coalesce((
        select count(*)::int from opportunities o
        join pipeline_stages ps on ps.function = o.function and ps.key = o.stage_key
        where o.owner_id = ${targets.userId} and o.function = ${targets.function} and ps.is_attrition
          and (${targets.editionId} is null or o.edition_id = ${targets.editionId})
      ), 0)`,
    })
    .from(targets)
    .innerJoin(users, eq(users.id, targets.userId))
    .leftJoin(editions, eq(editions.id, targets.editionId))
    .leftJoin(events, eq(events.id, sql`coalesce(${targets.eventId}, ${editions.eventId})`))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(targets.periodStart), asc(users.fullName));

  return rows.map((r) => {
    const target = Number(r.targetValue);
    const achieved = Number(r.achieved);
    const pipeline = Number(r.pipeline);
    const forecast = achieved + Number(r.weighted);
    return {
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      function: r.function as WorkFunction,
      metric: r.metric as "revenue" | "count",
      editionId: r.editionId,
      editionName: r.editionName,
      eventName: r.eventName,
      periodStart: String(r.periodStart),
      periodEnd: String(r.periodEnd),
      currency: r.currency,
      target,
      achieved,
      remaining: Math.max(0, target - achieved),
      pipeline,
      forecast,
      /* A percentage of nothing is not 0% — it is undefined, and printing 0%
         invites someone to read it as failure. */
      progressPct: target > 0 ? achieved / target : null,
      attended: r.attended,
      withdrawn: r.withdrawn,
    };
  });
}

/** Everyone a Super Admin can set a target for. */
export async function targetableUsers(q: ScopedQuery, ctx: AuthContext) {
  if (!canManageUsers(ctx)) throw forbidden("Only a Super Admin can set targets.");
  return q.directory
    .select({ id: users.id, fullName: users.fullName, role: users.role })
    .from(users)
    .where(eq(users.status, "active"))
    .orderBy(asc(users.fullName));
}
