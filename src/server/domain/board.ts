/**
 * THE PIPELINE BOARD — §4 rendered as columns.
 *
 * One query per board, not one per column. A stage-per-query board issues nine
 * round trips to draw one screen, and the counts drift between the first and
 * the last if anyone is working at the time.
 *
 * Every figure here is aggregated INSIDE the caller's scope, so a Team Member's
 * column totals are the totals of their own work and an Admin's are their
 * scoped events' — the numbers cannot disagree with the rows beneath them.
 */

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";

import { companies, editions, opportunities, people, users } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { WorkFunction } from "../auth/permissions";
import { opportunityFilterSql, type OpportunityFilters } from "./opportunities";
import { stagesFor, type Stage } from "./pipeline";

export type BoardColumn = Stage & {
  count: number;
  /** Sponsor only. Delegate and speaker are counted, never priced. */
  totalValue: number | null;
  weightedValue: number | null;
  currency: string;
};

export type BoardCard = {
  id: string;
  stageKey: string;
  personName: string;
  companyName: string | null;
  jobTitle: string | null;
  ownerId: string | null;
  ownerName: string | null;
  estimatedValue: string | null;
  finalValue: string | null;
  currency: string;
  probability: number;
  priority: "normal" | "high";
  nextAction: string | null;
  nextActionDueAt: Date | null;
  editionName: string;
  updatedAt: Date;
};

/**
 * Columns with their counts and money, plus the cards.
 *
 * `weightedValue` uses the probability stored ON THE OPPORTUNITY, not the
 * stage default — an operator who overrode it (§11) meant the override, and a
 * forecast that silently used the ladder instead would contradict the number
 * shown on the card.
 */
export async function pipelineBoard(
  q: ScopedQuery,
  fn: WorkFunction,
  filters: OpportunityFilters = {},
  cardLimit = 400,
): Promise<{ columns: BoardColumn[]; cards: BoardCard[] }> {
  const stages = await stagesFor(q, fn);
  const where = q.where.opportunities(
    and(
      opportunityFilterSql({ ...filters, function: fn }),
      isNull(opportunities.archivedAt),
    ) as SQL,
  );

  const [totals, cards] = await Promise.all([
    q.directory
      .select({
        stageKey: opportunities.stageKey,
        count: sql<number>`count(*)::int`,
        /* coalesce(final, estimated): a won deal's real number, an open deal's
           best guess. Summing only one of them would make the WON column read
           zero on a board where money has actually closed. */
        totalValue: sql<
          string | null
        >`sum(coalesce(${opportunities.finalValue}, ${opportunities.estimatedValue}, 0))`,
        weightedValue: sql<
          string | null
        >`sum(coalesce(${opportunities.estimatedValue}, 0) * ${opportunities.probability} / 100.0)`,
      })
      .from(opportunities)
      .innerJoin(people, eq(people.id, opportunities.personId))
      .innerJoin(editions, eq(editions.id, opportunities.editionId))
      .leftJoin(companies, eq(companies.id, opportunities.companyId))
      .where(where)
      .groupBy(opportunities.stageKey),

    q.directory
      .select({
        id: opportunities.id,
        stageKey: opportunities.stageKey,
        personName: people.fullName,
        companyName: companies.name,
        jobTitle: people.jobTitle,
        ownerId: opportunities.ownerId,
        ownerName: users.fullName,
        estimatedValue: opportunities.estimatedValue,
        finalValue: opportunities.finalValue,
        currency: opportunities.currency,
        probability: opportunities.probability,
        priority: opportunities.priority,
        nextAction: opportunities.nextAction,
        nextActionDueAt: opportunities.nextActionDueAt,
        editionName: editions.name,
        updatedAt: opportunities.updatedAt,
      })
      .from(opportunities)
      .innerJoin(people, eq(people.id, opportunities.personId))
      .innerJoin(editions, eq(editions.id, opportunities.editionId))
      .leftJoin(companies, eq(companies.id, opportunities.companyId))
      .leftJoin(users, eq(users.id, opportunities.ownerId))
      .where(where)
      .orderBy(opportunities.updatedAt)
      .limit(cardLimit),
  ]);

  const byStage = new Map(totals.map((t) => [t.stageKey, t]));
  const money = fn === "sponsor";

  const columns: BoardColumn[] = stages.map((stage) => {
    const t = byStage.get(stage.key);
    return {
      ...stage,
      count: t?.count ?? 0,
      totalValue: money ? Number(t?.totalValue ?? 0) : null,
      weightedValue: money ? Number(t?.weightedValue ?? 0) : null,
      currency: "USD",
    };
  });

  return { columns, cards: cards as BoardCard[] };
}

/**
 * §12 — the rates, computed from actual records.
 *
 * `NOT ENOUGH DATA` is a real answer. A close rate over four opportunities is
 * noise presented as a percentage, and presenting it would be exactly the fake
 * intelligence §12 forbids. The threshold is stated here, once.
 */
export const MIN_SAMPLE = 10;

export type Rate = { value: number | null; numerator: number; denominator: number };

const rate = (numerator: number, denominator: number): Rate => ({
  value: denominator >= MIN_SAMPLE ? numerator / denominator : null,
  numerator,
  denominator,
});

export async function conversionRates(
  q: ScopedQuery,
  fn: WorkFunction,
  filters: OpportunityFilters = {},
) {
  const where = q.where.opportunities(opportunityFilterSql({ ...filters, function: fn }));

  const rows = await q.directory
    .select({
      total: sql<number>`count(*)::int`,
      contacted: sql<number>`count(*) filter (where exists (
        select 1 from activities a
        where a.opportunity_id = ${opportunities.id} and a.type in ('call','email','meeting')
      ))::int`,
      met: sql<number>`count(*) filter (where exists (
        select 1 from activities a
        where a.opportunity_id = ${opportunities.id} and a.type = 'meeting'
      ))::int`,
      proposed: sql<number>`count(*) filter (where exists (
        select 1 from activities a
        where a.opportunity_id = ${opportunities.id} and a.type = 'proposal'
      ))::int`,
      /* Achievement per §4: the timestamp, minus anyone who has since
         withdrawn. Reading is_won on the CURRENT stage would drop every
         delegate who went on to attend. */
      achieved: sql<number>`count(*) filter (where ${opportunities.wonAt} is not null and not exists (
        select 1 from pipeline_stages ps
        where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_attrition
      ))::int`,
      lost: sql<number>`count(*) filter (where exists (
        select 1 from pipeline_stages ps
        where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_lost
      ))::int`,
      /* D4 — attrition is reported beside the loss rate, never inside it. */
      withdrawn: sql<number>`count(*) filter (where exists (
        select 1 from pipeline_stages ps
        where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_attrition
      ))::int`,
      /* D2 — attendance is its own KPI, measured against those who confirmed. */
      attended: sql<number>`count(*) filter (where exists (
        select 1 from pipeline_stages ps
        where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_attendance
      ))::int`,
      converted: sql<number>`count(*) filter (where ${opportunities.wonAt} is not null)::int`,
      avgDealSize: sql<
        string | null
      >`avg(${opportunities.finalValue}) filter (where ${opportunities.finalValue} is not null)`,
      avgDaysToClose: sql<
        number | null
      >`avg(extract(epoch from (${opportunities.wonAt} - ${opportunities.createdAt})) / 86400)
        filter (where ${opportunities.wonAt} is not null)`,
    })
    .from(opportunities)
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .where(where);

  const r = rows[0];
  if (!r) return null;

  return {
    total: r.total,
    contactRate: rate(r.contacted, r.total),
    meetingRate: rate(r.met, r.total),
    proposalRate: rate(r.proposed, r.total),
    closeRate: rate(r.achieved, r.total),
    lossRate: rate(r.lost, r.total),
    /* Denominators differ deliberately. Attrition and attendance are measured
       against those who CONVERTED, not against every opportunity ever opened —
       you cannot withdraw from something you never confirmed. */
    attritionRate: rate(r.withdrawn, r.converted),
    attendanceRate: rate(r.attended, r.converted),
    achieved: r.achieved,
    withdrawn: r.withdrawn,
    attended: r.attended,
    avgDealSize: r.avgDealSize ? Number(r.avgDealSize) : null,
    avgDaysToClose:
      r.avgDaysToClose != null && r.achieved >= MIN_SAMPLE ? Number(r.avgDaysToClose) : null,
    /* Stated, so a screen can say NOT ENOUGH DATA rather than showing 0%. */
    minSample: MIN_SAMPLE,
  };
}
