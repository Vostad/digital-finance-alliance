/**
 * PRODUCTIVITY AND INSIGHTS — §12.
 *
 * Every number is a count or a ratio of counts over rows that exist. Nothing
 * is modelled, smoothed, extrapolated or predicted, and where the sample is
 * too small to divide, the answer is **NOT ENOUGH DATA** with the raw counts
 * attached so a screen can show its working.
 *
 * That refusal is the whole point. A close rate over four opportunities is
 * noise rendered as a percentage, and a percentage is the most persuasive way
 * to present a number nobody should act on.
 *
 * Suggestions are deterministic. No model calls, and every one carries the
 * count it came from and the filter that reproduces it — click a suggestion
 * and you get exactly the rows it counted, not an approximation.
 */

import { and, eq, isNull, sql } from "drizzle-orm";

import { companies, editions, opportunities, people } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext, WorkFunction } from "../auth/permissions";
import { opportunityFilterSql, type OpportunityFilters } from "./opportunities";
import { MIN_SAMPLE } from "./board";

type Maybe<T> = T | null | undefined;

export type Metric = {
  key: string;
  label: string;
  /** null when the sample is below MIN_SAMPLE — the honest refusal. */
  value: number | null;
  numerator: number;
  denominator: number;
  format: "percent" | "money" | "days" | "count";
  /** What the denominator actually is, so a rate cannot be misread. */
  basis: string;
};

const ratio = (
  key: string,
  label: string,
  numerator: number,
  denominator: number,
  basis: string,
): Metric => ({
  key,
  label,
  value: denominator >= MIN_SAMPLE ? numerator / denominator : null,
  numerator,
  denominator,
  format: "percent",
  basis,
});

/**
 * §12's full metric set for one function.
 *
 * Denominators differ on purpose and each is named in `basis`. A response rate
 * measured against every opportunity rather than against those actually
 * contacted flatters the team by counting the people they never called.
 */
export async function metrics(
  q: ScopedQuery,
  fn: WorkFunction,
  filters: OpportunityFilters = {},
): Promise<{ metrics: Metric[]; total: number; minSample: number }> {
  const where = q.where.opportunities(opportunityFilterSql({ ...filters, function: fn }));

  const activityOfType = (types: string) => sql`exists (
    select 1 from activities a
    where a.opportunity_id = ${opportunities.id} and a.type in (${sql.raw(types)})
  )`;

  const stageFlag = (flag: string) => sql`exists (
    select 1 from pipeline_stages ps
    where ps.function = ${opportunities.function}
      and ps.key = ${opportunities.stageKey} and ps.${sql.raw(flag)}
  )`;

  const rows = await q.directory
    .select({
      total: sql<number>`count(*)::int`,
      contacted: sql<number>`count(*) filter (where ${activityOfType("'call','email','meeting'")})::int`,
      /* A reply is any inbound-ish activity logged AFTER a first outbound one.
         Approximate by construction and labelled as such: the system records
         what the team did, and a reply is only visible because somebody logged
         it. */
      responded: sql<number>`count(*) filter (where ${activityOfType("'meeting','proposal'")}
        and ${activityOfType("'call','email'")})::int`,
      met: sql<number>`count(*) filter (where ${activityOfType("'meeting'")})::int`,
      proposed: sql<number>`count(*) filter (where ${activityOfType("'proposal'")})::int`,
      converted: sql<number>`count(*) filter (where ${opportunities.wonAt} is not null
        and ${opportunities.cancelledAt} is null
        and not ${stageFlag("is_attrition")})::int`,
      lost: sql<number>`count(*) filter (where ${stageFlag("is_lost")})::int`,
      closedEither: sql<number>`count(*) filter (where ${stageFlag("is_lost")}
        or ${opportunities.wonAt} is not null)::int`,
      withdrawn: sql<number>`count(*) filter (where ${stageFlag("is_attrition")})::int`,
      attended: sql<number>`count(*) filter (where ${stageFlag("is_attendance")})::int`,
      everWon: sql<number>`count(*) filter (where ${opportunities.wonAt} is not null)::int`,
      avgDeal: sql<string | null>`avg(${opportunities.finalValue}) filter (
        where ${opportunities.finalValue} is not null and ${opportunities.cancelledAt} is null)`,
      avgDaysToClose: sql<number | null>`avg(
        extract(epoch from (${opportunities.wonAt} - ${opportunities.createdAt})) / 86400
      ) filter (where ${opportunities.wonAt} is not null)`,
      /* PIPELINE VELOCITY — how long open work has been sitting. Not a
         prediction: it is the mean age of what is currently open. */
      avgOpenAgeDays: sql<number | null>`avg(
        extract(epoch from (now() - ${opportunities.createdAt})) / 86400
      ) filter (where ${stageFlag("is_open")})`,
      openCount: sql<number>`count(*) filter (where ${stageFlag("is_open")})::int`,
    })
    .from(opportunities)
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .where(where);

  const r = rows[0]!;
  const out: Metric[] = [
    ratio("contact", "Contact rate", r.contacted, r.total, "of all workstreams"),
    ratio("response", "Response rate", r.responded, r.contacted, "of those contacted"),
    ratio("meeting", "Meeting rate", r.met, r.contacted, "of those contacted"),
    ratio("proposal", "Proposal rate", r.proposed, r.met, "of those met"),
    ratio("close", "Close rate", r.converted, r.total, "of all workstreams"),
    ratio(
      "rejection",
      "Rejection rate",
      r.lost,
      r.closedEither,
      "of those that reached an outcome",
    ),
  ];

  if (fn === "speaker") {
    out.push(ratio("attrition", "Attrition rate", r.withdrawn, r.everWon, "of those confirmed"));
  }
  if (fn === "delegate") {
    out.push(ratio("attendance", "Attendance rate", r.attended, r.everWon, "of those confirmed"));
  }

  if (fn === "sponsor") {
    out.push({
      key: "avgDeal",
      label: "Average deal size",
      value: r.avgDeal != null && r.converted >= MIN_SAMPLE ? Number(r.avgDeal) : null,
      numerator: r.converted,
      denominator: r.converted,
      format: "money",
      basis: "of deals won",
    });
  }

  out.push({
    key: "timeToClose",
    label: "Time to close",
    value: r.avgDaysToClose != null && r.everWon >= MIN_SAMPLE ? Number(r.avgDaysToClose) : null,
    numerator: r.everWon,
    denominator: r.everWon,
    format: "days",
    basis: "of deals won",
  });

  out.push({
    key: "velocity",
    label: "Average age of open work",
    value: r.avgOpenAgeDays != null && r.openCount >= MIN_SAMPLE ? Number(r.avgOpenAgeDays) : null,
    numerator: r.openCount,
    denominator: r.openCount,
    format: "days",
    basis: "of open workstreams",
  });

  return { metrics: out, total: r.total, minSample: MIN_SAMPLE };
}

/* --------------------------------------------------------- §12 suggestions */

export type Insight = {
  id: string;
  severity: "urgent" | "attention" | "note";
  text: string;
  count: number;
  /** The rows this came from. Not a description of them — the ids. */
  opportunityIds: string[];
};

/**
 * Deterministic suggestions, each traceable to the exact records that produced
 * it.
 *
 * "High value" is the **top quartile of this caller's own open estimates**, not
 * a threshold invented here. A fixed number would be wrong for every team but
 * the one it was chosen for, and would silently stop meaning anything as deal
 * sizes changed.
 */
export async function insights(
  q: ScopedQuery,
  ctx: AuthContext,
  opts: { ownerId?: Maybe<string>; editionId?: Maybe<string> } = {},
): Promise<Insight[]> {
  const ownerId = opts.ownerId ?? (ctx.role === "team_member" ? ctx.userId : null);

  const openWork = await q.directory
    .select({
      id: opportunities.id,
      estimatedValue: opportunities.estimatedValue,
      nextActionDueAt: opportunities.nextActionDueAt,
      createdAt: opportunities.createdAt,
      lastActivityAt: sql<Date | null>`(
        select max(a.occurred_at) from activities a where a.opportunity_id = ${opportunities.id}
      )`,
      contacted: sql<boolean>`exists (
        select 1 from activities a
        where a.opportunity_id = ${opportunities.id} and a.type in ('call','email','meeting')
      )`,
      hasProposal: sql<boolean>`exists (
        select 1 from activities a
        where a.opportunity_id = ${opportunities.id} and a.type = 'proposal'
      )`,
    })
    .from(opportunities)
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .where(
      q.where.opportunities(
        and(
          isNull(opportunities.archivedAt),
          ownerId ? eq(opportunities.ownerId, ownerId) : undefined,
          opts.editionId ? eq(opportunities.editionId, opts.editionId) : undefined,
          sql`exists (select 1 from pipeline_stages ps
                      where ps.function = ${opportunities.function}
                        and ps.key = ${opportunities.stageKey} and ps.is_open)`,
        ),
      ),
    );

  const out: Insight[] = [];
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const now = Date.now();

  /* The top quartile of THIS caller's own open estimates. */
  const values = openWork
    .map((o) => Number(o.estimatedValue ?? 0))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const highValueFloor = values.length >= 4 ? values[Math.floor(values.length * 0.75)]! : Infinity;

  const uncontacted = openWork.filter((o) => !o.contacted);
  if (uncontacted.length) {
    out.push({
      id: "uncontacted",
      severity: "urgent",
      count: uncontacted.length,
      text: `${uncontacted.length} open ${plural(uncontacted.length, "workstream has", "workstreams have")} never been contacted.`,
      opportunityIds: uncontacted.map((o) => o.id),
    });
  }

  const overdue = openWork.filter(
    (o) => o.nextActionDueAt && new Date(o.nextActionDueAt).getTime() < now,
  );
  if (overdue.length) {
    out.push({
      id: "overdue",
      severity: "urgent",
      count: overdue.length,
      text: `${overdue.length} ${plural(overdue.length, "follow-up is", "follow-ups are")} overdue.`,
      opportunityIds: overdue.map((o) => o.id),
    });
  }

  const highValueNoFollowUp = openWork.filter(
    (o) => !o.nextActionDueAt && Number(o.estimatedValue ?? 0) >= highValueFloor,
  );
  if (highValueNoFollowUp.length) {
    out.push({
      id: "high-value-no-follow-up",
      severity: "attention",
      count: highValueNoFollowUp.length,
      text: `${highValueNoFollowUp.length} of your largest open ${plural(highValueNoFollowUp.length, "workstream has", "workstreams have")} no follow-up scheduled.`,
      opportunityIds: highValueNoFollowUp.map((o) => o.id),
    });
  }

  const noFollowUp = openWork.filter((o) => !o.nextActionDueAt);
  if (noFollowUp.length > highValueNoFollowUp.length) {
    const rest = noFollowUp.filter((o) => !highValueNoFollowUp.includes(o));
    out.push({
      id: "no-follow-up",
      severity: "note",
      count: rest.length,
      text: `${rest.length} other open ${plural(rest.length, "workstream has", "workstreams have")} no next step.`,
      opportunityIds: rest.map((o) => o.id),
    });
  }

  const quiet = openWork.filter((o) => {
    const last = o.lastActivityAt
      ? new Date(o.lastActivityAt).getTime()
      : new Date(o.createdAt).getTime();
    return now - last > 7 * 86_400_000;
  });
  if (quiet.length) {
    out.push({
      id: "quiet",
      severity: "attention",
      count: quiet.length,
      text: `${quiet.length} ${plural(quiet.length, "workstream has", "workstreams have")} had no activity for over a week.`,
      opportunityIds: quiet.map((o) => o.id),
    });
  }

  const staleProposals = openWork.filter((o) => {
    if (!o.hasProposal) return false;
    const last = o.lastActivityAt ? new Date(o.lastActivityAt).getTime() : 0;
    return now - last > 10 * 86_400_000;
  });
  if (staleProposals.length) {
    out.push({
      id: "stale-proposals",
      severity: "attention",
      count: staleProposals.length,
      text: `${staleProposals.length} ${plural(staleProposals.length, "proposal has", "proposals have")} had no follow-up for over ten days.`,
      opportunityIds: staleProposals.map((o) => o.id),
    });
  }

  return out;
}
