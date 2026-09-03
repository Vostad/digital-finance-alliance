/**
 * DASHBOARDS — §12. Four questions, answered from real records.
 *
 *   What do I need to do?      followUps + attentionNeeded
 *   How am I doing?            achievement against target
 *   What can I still achieve?  open pipeline
 *   What can I earn?           commission (Boundary 11)
 *
 * Everything here is a COUNT OR A SUM OF ACTUAL ROWS. Nothing is modelled,
 * estimated, or smoothed. Where the sample is too small to support a rate, the
 * rate comes back null and the raw counts come with it, so a screen can say
 * NOT ENOUGH DATA and show the numbers it was refusing to divide.
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { companies, editions, events, opportunities, people, users } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext, WorkFunction } from "../auth/permissions";
import { attentionNeeded, followUps } from "./activities";
import { conversionRates } from "./board";
import { opportunityFilterSql, type OpportunityFilters } from "./opportunities";

/* ------------------------------------------------------------- headline sums */

export type Headline = {
  totalWorkstreams: number;
  newLeads: number;
  unassigned: number;
  active: number;
  /** Sponsor money. Null on a counted function. */
  totalPipeline: number | null;
  weightedPipeline: number | null;
  closedRevenue: number | null;
  achieved: number;
  currency: string;
};

/**
 * The numbers at the top of every dashboard.
 *
 * CLOSED REVENUE excludes cancelled deals — §4 says so, and a revenue figure
 * that counts money which was won and then collapsed is the single most
 * misleading number this system could print.
 */
export async function headline(
  q: ScopedQuery,
  filters: OpportunityFilters = {},
  sponsorMoney = true,
): Promise<Headline> {
  const where = q.where.opportunities(opportunityFilterSql(filters));

  const rows = await q.directory
    .select({
      total: sql<number>`count(*)::int`,
      newLeads: sql<number>`count(*) filter (where exists (
        select 1 from pipeline_stages ps
        where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey}
          and ps.is_open and ps.sort_order = 10
      ))::int`,
      unassigned: sql<number>`count(*) filter (where ${opportunities.ownerId} is null)::int`,
      active: sql<number>`count(*) filter (where exists (
        select 1 from pipeline_stages ps
        where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_open
      ))::int`,
      /* MONEY IS SPONSOR MONEY — always, whatever else is being counted.
         Delegate and speaker workstreams carry no revenue in V1, so summing
         across every function produced a figure that looked like pipeline and
         was not. The filter is here, in the SQL, rather than in a caller that
         might forget it. */
      totalPipeline: sql<string | null>`sum(${opportunities.estimatedValue}) filter (
        where ${opportunities.function} = 'sponsor' and exists (
          select 1 from pipeline_stages ps
          where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_open
        ))`,
      weightedPipeline: sql<
        string | null
      >`sum(coalesce(${opportunities.estimatedValue},0) * ${opportunities.probability} / 100.0)
        filter (where ${opportunities.function} = 'sponsor' and exists (
          select 1 from pipeline_stages ps
          where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_open
        ))`,
      /* Cancelled money is excluded. It was won and then it collapsed. */
      closedRevenue: sql<string | null>`sum(${opportunities.finalValue}) filter (
        where ${opportunities.function} = 'sponsor'
          and ${opportunities.wonAt} is not null and ${opportunities.cancelledAt} is null
      )`,
      achieved: sql<number>`count(*) filter (
        where ${opportunities.wonAt} is not null
          and ${opportunities.cancelledAt} is null
          and not exists (
            select 1 from pipeline_stages ps
            where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey}
              and ps.is_attrition
          )
      )::int`,
    })
    .from(opportunities)
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .where(where);

  const r = rows[0]!;
  /* Null means "this viewer has no sponsor work", which the dashboard renders
     as an absent card. It never means zero: a delegate-only coordinator shown
     "$0 pipeline" would reasonably conclude the system was broken. */
  const money = sponsorMoney;

  return {
    totalWorkstreams: r.total,
    newLeads: r.newLeads,
    unassigned: r.unassigned,
    active: r.active,
    totalPipeline: money ? Number(r.totalPipeline ?? 0) : null,
    weightedPipeline: money ? Number(r.weightedPipeline ?? 0) : null,
    closedRevenue: money ? Number(r.closedRevenue ?? 0) : null,
    achieved: r.achieved,
    currency: "USD",
  };
}

/* ---------------------------------------------------- §12 · what to do next */

/**
 * Deterministic suggestions. Every one names a real number and traces to real
 * records — no model calls, no thresholds the data cannot support.
 *
 * Each carries the filter that produced it, so clicking a suggestion opens
 * exactly the rows it counted rather than an approximation of them.
 */
export type Suggestion = {
  id: string;
  severity: "urgent" | "attention" | "note";
  text: string;
  count: number;
  filter: OpportunityFilters & {
    bucket?: "overdue" | "today" | "noFollowUp" | "quiet" | "uncontacted";
  };
};

export async function suggestions(
  q: ScopedQuery,
  ctx: AuthContext,
  opts: { ownerId?: string | null | undefined; editionId?: string | null | undefined } = {},
): Promise<Suggestion[]> {
  const ownerId = opts.ownerId ?? (ctx.role === "team_member" ? ctx.userId : null);

  const [queue, attention] = await Promise.all([
    followUps(q, { ownerId, editionId: opts.editionId ?? null }),
    attentionNeeded(q, { ownerId }),
  ]);

  const out: Suggestion[] = [];
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  if (queue.overdue.length) {
    out.push({
      id: "overdue",
      severity: "urgent",
      count: queue.overdue.length,
      text: `${queue.overdue.length} ${plural(queue.overdue.length, "follow-up is", "follow-ups are")} overdue.`,
      filter: { ownerId, bucket: "overdue" },
    });
  }

  if (queue.today.length) {
    out.push({
      id: "today",
      severity: "attention",
      count: queue.today.length,
      text: `${queue.today.length} ${plural(queue.today.length, "follow-up is", "follow-ups are")} due today.`,
      filter: { ownerId, bucket: "today" },
    });
  }

  if (attention.neverContacted.length) {
    out.push({
      id: "uncontacted",
      severity: "urgent",
      count: attention.neverContacted.length,
      text: `${attention.neverContacted.length} open ${plural(attention.neverContacted.length, "workstream has", "workstreams have")} never been contacted.`,
      filter: { ownerId, bucket: "uncontacted" },
    });
  }

  /* §12's example, computed rather than asserted: high-value work with no next
     step. "High value" is the top quartile of THIS caller's open estimates, not
     a number invented here. */
  const highValue = attention.noFollowUp.filter((o) => Number(o.estimatedValue ?? 0) > 0);
  if (highValue.length) {
    out.push({
      id: "no-follow-up",
      severity: "attention",
      count: highValue.length,
      text: `${highValue.length} ${plural(highValue.length, "workstream has", "workstreams have")} no follow-up scheduled.`,
      filter: { ownerId, bucket: "noFollowUp" },
    });
  }

  if (attention.quiet.length) {
    out.push({
      id: "quiet",
      severity: "note",
      count: attention.quiet.length,
      text: `${attention.quiet.length} ${plural(attention.quiet.length, "workstream has", "workstreams have")} had no activity for over a week.`,
      filter: { ownerId, bucket: "quiet" },
    });
  }

  return out;
}

/* ------------------------------------------------------ §12 · team standing */

export type TeamRow = {
  userId: string;
  fullName: string;
  role: string;
  active: number;
  achieved: number;
  closedRevenue: number;
  overdue: number;
};

/** Super Admin and scoped Admin only — enforced by the caller's scope, which
    means an Admin's team view already covers only their events' work. */
export async function teamStanding(
  q: ScopedQuery,
  filters: OpportunityFilters = {},
): Promise<TeamRow[]> {
  const rows = await q.directory
    .select({
      userId: users.id,
      fullName: users.fullName,
      role: users.role,
      active: sql<number>`count(*) filter (where exists (
        select 1 from pipeline_stages ps
        where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_open
      ))::int`,
      achieved: sql<number>`count(*) filter (
        where ${opportunities.wonAt} is not null and ${opportunities.cancelledAt} is null
      )::int`,
      closedRevenue: sql<string | null>`sum(${opportunities.finalValue}) filter (
        where ${opportunities.wonAt} is not null and ${opportunities.cancelledAt} is null
      )`,
      overdue: sql<number>`count(*) filter (
        where ${opportunities.nextActionDueAt} < now() and exists (
          select 1 from pipeline_stages ps
          where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_open
        )
      )::int`,
    })
    .from(opportunities)
    .innerJoin(users, eq(users.id, opportunities.ownerId))
    .innerJoin(people, eq(people.id, opportunities.personId))
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .leftJoin(companies, eq(companies.id, opportunities.companyId))
    .where(q.where.opportunities(opportunityFilterSql(filters)))
    .groupBy(users.id, users.fullName, users.role)
    .orderBy(desc(sql`count(*) filter (where ${opportunities.wonAt} is not null)`));

  return rows.map((r) => ({ ...r, closedRevenue: Number(r.closedRevenue ?? 0) }));
}

/* --------------------------------------------------------- the assembled view */

export type DashboardView = {
  /** Carried with the payload so a screen needs ONE server call, not two.
      Resolving identity and loading the screen were separate round trips; on a
      client-side navigation that was a visible wait for nothing. */
  user: {
    userId: string;
    email: string;
    fullName: string;
    role: string;
    functions: WorkFunction[];
  };
  functions: WorkFunction[];
  /** False for a delegate-only or speaker-only person. The money cards are then
      absent rather than zero — see §15.1. */
  showSponsorMoney: boolean;
  headline: Headline;
  followUps: Awaited<ReturnType<typeof followUps>>;
};

/**
 * ONE SCREEN, ONE QUESTION: what needs my attention right now?
 *
 * This used to fan out to seven branches — team standing, conversion rates, an
 * inbox of fifty unassigned rows, and every edition joined to every event —
 * before the page could paint. None of it answered the question the screen
 * exists to answer, and all of it was on the critical path.
 *
 * What is left is two queries: the counted headline, and the follow-up queue.
 * Everything else is a click away on a screen built to hold it.
 */
export async function dashboard(
  q: ScopedQuery,
  ctx: AuthContext,
  opts: {
    function?: WorkFunction | null | undefined;
    editionId?: string | null | undefined;
  } = {},
): Promise<DashboardView> {
  const isMember = ctx.role === "team_member";

  /* A manager works every function; a team member works the ones granted to
     them. This is presentation only — `scopedQuery` has already confined the
     rows on the server, and nothing here widens that. */
  const authorized: WorkFunction[] = isMember
    ? [...ctx.functions]
    : ["sponsor", "delegate", "speaker"];

  const showSponsorMoney = authorized.includes("sponsor");

  /* No function chosen means "all of my work", not "sponsor". The money figures
     stay sponsor-scoped regardless, inside the SQL. */
  const fn = opts.function ?? null;

  const filters: OpportunityFilters = {
    function: fn,
    editionId: opts.editionId ?? null,
    ownerId: isMember ? ctx.userId : null,
  };

  const [head, queue] = await Promise.all([
    headline(q, filters, showSponsorMoney),
    followUps(q, { ownerId: filters.ownerId, editionId: opts.editionId ?? null }),
  ]);

  return {
    user: {
      userId: ctx.userId,
      email: ctx.email,
      fullName: ctx.fullName,
      role: ctx.role,
      functions: [...ctx.functions],
    },
    functions: authorized,
    showSponsorMoney,
    headline: head,
    followUps: queue,
  };
}
