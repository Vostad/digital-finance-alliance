/**
 * FORECAST — §11.
 *
 * TOTAL PIPELINE · WEIGHTED PIPELINE · CLOSED REVENUE · TARGET · REMAINING ·
 * FORECAST, sliced by edition and by owner.
 *
 * THE WORD MATTERS. Everything here is labelled FORECAST and never committed
 * revenue, because a weighted number is a probability-weighted sum of deals
 * that have not happened. `closedRevenue` is the only figure in this module
 * that describes money the business actually has, and it excludes cancelled
 * deals — money that was won and then collapsed is not revenue.
 *
 * The weight comes from `opportunities.probability`, which starts at the §4
 * ladder default and may be overridden per opportunity. `probability_overridden`
 * records which, so the forecast can be read both ways: as the model says, and
 * as the person closest to the deal says.
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { companies, editions, events, opportunities, people, targets, users } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext, WorkFunction } from "../auth/permissions";
import { opportunityFilterSql, type OpportunityFilters } from "./opportunities";

type Maybe<T> = T | null | undefined;

/** Open work only. Closed deals are revenue or history, never forecast. */
const OPEN = sql`exists (
  select 1 from pipeline_stages ps
  where ps.function = ${opportunities.function}
    and ps.key = ${opportunities.stageKey}
    and ps.is_open
)`;

export type ForecastRow = {
  totalPipeline: number;
  weightedPipeline: number;
  /** Weighted using the §4 ladder default rather than any override — the
      model's own view, for comparison against the humans'. */
  weightedAtLadder: number;
  closedRevenue: number;
  target: number;
  remaining: number;
  /** closedRevenue + weightedPipeline. A FORECAST. */
  forecast: number;
  /** How much of the weighting rests on human judgement rather than the ladder. */
  overriddenCount: number;
  overriddenValue: number;
  openCount: number;
  currency: string;
};

const n = (v: string | number | null | undefined) => Number(v ?? 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

async function measure(
  q: ScopedQuery,
  filters: OpportunityFilters,
  targetFilter: {
    editionId?: Maybe<string>;
    ownerId?: Maybe<string>;
    function?: Maybe<WorkFunction>;
  },
): Promise<ForecastRow> {
  const where = q.where.opportunities(opportunityFilterSql(filters));

  const rows = await q.directory
    .select({
      openCount: sql<number>`count(*) filter (where ${OPEN})::int`,
      totalPipeline: sql<string>`coalesce(sum(${opportunities.estimatedValue}) filter (where ${OPEN}), 0)`,
      weightedPipeline: sql<string>`coalesce(sum(
        coalesce(${opportunities.estimatedValue}, 0) * ${opportunities.probability} / 100.0
      ) filter (where ${OPEN}), 0)`,
      /* The same sum, but forced back onto the configured ladder. The gap
         between this and the line above IS the human adjustment. */
      weightedAtLadder: sql<string>`coalesce(sum(
        coalesce(${opportunities.estimatedValue}, 0) * (
          select ps.default_probability from pipeline_stages ps
          where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey}
        ) / 100.0
      ) filter (where ${OPEN}), 0)`,
      closedRevenue: sql<string>`coalesce(sum(${opportunities.finalValue}) filter (
        where ${opportunities.wonAt} is not null and ${opportunities.cancelledAt} is null
      ), 0)`,
      overriddenCount: sql<number>`count(*) filter (
        where ${OPEN} and ${opportunities.probabilityOverridden}
      )::int`,
      overriddenValue: sql<string>`coalesce(sum(${opportunities.estimatedValue}) filter (
        where ${OPEN} and ${opportunities.probabilityOverridden}
      ), 0)`,
    })
    .from(opportunities)
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .where(where);

  const r = rows[0]!;

  /* Targets are summed over the same slice, so REMAINING is the remainder of
     a number that actually applies to these rows. */
  const targetConds = [eq(targets.function, targetFilter.function ?? "sponsor")];
  if (targetFilter.editionId) targetConds.push(eq(targets.editionId, targetFilter.editionId));
  if (targetFilter.ownerId) targetConds.push(eq(targets.userId, targetFilter.ownerId));

  const targetRows = await q.directory
    .select({ total: sql<string>`coalesce(sum(${targets.targetValue}), 0)` })
    .from(targets)
    .where(and(...targetConds));

  const target = n(targetRows[0]?.total);
  const closedRevenue = n(r.closedRevenue);
  const weightedPipeline = round2(n(r.weightedPipeline));

  return {
    openCount: r.openCount,
    totalPipeline: n(r.totalPipeline),
    weightedPipeline,
    weightedAtLadder: round2(n(r.weightedAtLadder)),
    closedRevenue,
    target,
    remaining: Math.max(0, target - closedRevenue),
    forecast: round2(closedRevenue + weightedPipeline),
    overriddenCount: r.overriddenCount,
    overriddenValue: n(r.overriddenValue),
    currency: "USD",
  };
}

export type ForecastView = {
  overall: ForecastRow;
  byEdition: (ForecastRow & { editionId: string; editionName: string; eventName: string })[];
  byOwner: (ForecastRow & { ownerId: string; ownerName: string })[];
  /** Stated on every screen that renders this. */
  label: "FORECAST";
  caveat: string;
};

/**
 * The whole §11 view, scoped.
 *
 * A Team Member reaching this sees their own numbers — `q.where.opportunities`
 * already confines every sum — and the by-owner breakdown collapses to one
 * row, which is theirs.
 */
export async function forecast(
  q: ScopedQuery,
  ctx: AuthContext,
  opts: { editionId?: Maybe<string>; function?: Maybe<WorkFunction> } = {},
): Promise<ForecastView> {
  const fn = opts.function ?? "sponsor";
  const ownerId = ctx.role === "team_member" ? ctx.userId : null;
  const base: OpportunityFilters = { function: fn, editionId: opts.editionId ?? null, ownerId };

  const overall = await measure(q, base, {
    editionId: opts.editionId ?? null,
    ownerId,
    function: fn,
  });

  const editionRows = await q.directory
    .select({
      editionId: editions.id,
      editionName: editions.name,
      eventName: events.name,
    })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .orderBy(desc(editions.startsOn));

  const byEdition = [];
  for (const ed of editionRows) {
    const row = await measure(
      q,
      { ...base, editionId: ed.editionId },
      {
        editionId: ed.editionId,
        ownerId,
        function: fn,
      },
    );
    /* A row with nothing in it and no target is noise on a forecast screen. */
    if (row.openCount === 0 && row.closedRevenue === 0 && row.target === 0) continue;
    byEdition.push({ ...row, ...ed });
  }

  const ownerRows = await q.directory
    .selectDistinct({ ownerId: users.id, ownerName: users.fullName })
    .from(opportunities)
    .innerJoin(users, eq(users.id, opportunities.ownerId))
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .where(q.where.opportunities(opportunityFilterSql(base)));

  const byOwner = [];
  for (const owner of ownerRows) {
    const row = await measure(
      q,
      { ...base, ownerId: owner.ownerId },
      {
        editionId: opts.editionId ?? null,
        ownerId: owner.ownerId,
        function: fn,
      },
    );
    byOwner.push({ ...row, ...owner });
  }

  return {
    overall,
    byEdition,
    byOwner: byOwner.sort((a, b) => b.forecast - a.forecast),
    label: "FORECAST",
    caveat:
      "Forecast is closed revenue plus weighted open pipeline. It is not committed revenue and no part of it is guaranteed.",
  };
}

/**
 * §11 — the opportunity-level override, recorded.
 *
 * Setting the probability back to the stage default clears the override flag
 * rather than recording a "manual" value that happens to equal the ladder —
 * otherwise the count of human-adjusted deals inflates with every deal someone
 * looked at and agreed with.
 */
export async function overrideProbability(
  q: ScopedQuery,
  opportunityId: string,
  probability: number | null,
  ctx: AuthContext,
) {
  const { loadForWrite, ValidationError } = await import("./opportunities");
  const { findStage } = await import("./pipeline");
  const { recordAudit } = await import("./audit");

  const current = await loadForWrite(q, opportunityId, ctx);
  const stage = await findStage(q, current.function, current.stageKey);
  if (!stage) throw new ValidationError("That stage no longer exists.");

  if (probability != null && (probability < 0 || probability > 100)) {
    throw new ValidationError("Probability must be between 0 and 100.");
  }

  const next = probability ?? stage.defaultProbability;
  const overridden = probability != null && probability !== stage.defaultProbability;

  return q.directory.transaction(async (tx) => {
    await tx
      .update(opportunities)
      .set({
        probability: next,
        probabilityOverridden: overridden,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(opportunities.id, opportunityId));

    await recordAudit(tx, {
      ctx,
      entityType: "opportunity",
      entityId: opportunityId,
      action: "updated",
      before: { probability: current.probability },
      after: { probability: next, probabilityOverridden: overridden },
    });

    return { probability: next, overridden };
  });
}

/** Open deals whose probability a person has moved off the ladder. */
export async function overriddenOpportunities(q: ScopedQuery, fn: WorkFunction = "sponsor") {
  return q.directory
    .select({
      id: opportunities.id,
      personName: people.fullName,
      companyName: companies.name,
      stageKey: opportunities.stageKey,
      probability: opportunities.probability,
      ladderProbability: sql<number>`(
        select ps.default_probability from pipeline_stages ps
        where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey}
      )`,
      estimatedValue: opportunities.estimatedValue,
      currency: opportunities.currency,
      ownerName: users.fullName,
    })
    .from(opportunities)
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(
      q.where.opportunities(
        and(
          eq(opportunities.function, fn),
          eq(opportunities.probabilityOverridden, true),
          isNull(opportunities.archivedAt),
          OPEN,
        ),
      ),
    )
    .limit(100);
}
