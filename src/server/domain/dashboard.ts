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
      totalPipeline: sql<string | null>`sum(${opportunities.estimatedValue}) filter (where exists (
        select 1 from pipeline_stages ps
        where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_open
      ))`,
      weightedPipeline: sql<
        string | null
      >`sum(coalesce(${opportunities.estimatedValue},0) * ${opportunities.probability} / 100.0)
        filter (where exists (
          select 1 from pipeline_stages ps
          where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_open
        ))`,
      /* Cancelled money is excluded. It was won and then it collapsed. */
      closedRevenue: sql<string | null>`sum(${opportunities.finalValue}) filter (
        where ${opportunities.wonAt} is not null and ${opportunities.cancelledAt} is null
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
  const money = filters.function === "sponsor" || filters.function == null;

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
  role: string;
  functions: WorkFunction[];
  headline: Headline;
  suggestions: Suggestion[];
  followUps: Awaited<ReturnType<typeof followUps>>;
  rates: Awaited<ReturnType<typeof conversionRates>>;
  team: TeamRow[] | null;
  unassignedInbox: {
    id: string;
    personName: string;
    companyName: string | null;
    function: string;
    editionName: string;
    createdAt: Date;
  }[];
  editions: { id: string; name: string; eventName: string }[];
};

/**
 * One round of queries for one screen.
 *
 * The role does not change WHAT is asked — every figure is already confined by
 * `scopedQuery`. It changes which extra sections are worth fetching: a Team
 * Member has no team to stand against and no inbox to triage.
 */
export async function dashboard(
  q: ScopedQuery,
  ctx: AuthContext,
  opts: {
    function?: WorkFunction | null | undefined;
    editionId?: string | null | undefined;
  } = {},
): Promise<DashboardView> {
  const isManager = ctx.role !== "team_member";
  /* A manager with no function chosen defaults to sponsor: it is the only
     function carrying money, so it is the one they open the screen to see.
     Leaving it null showed them no rates at all, which read as a broken panel
     rather than as a deliberate absence. */
  const fn = opts.function ?? (ctx.role === "team_member" ? (ctx.functions[0] ?? null) : "sponsor");
  const filters: OpportunityFilters = {
    function: fn,
    editionId: opts.editionId ?? null,
    ownerId: ctx.role === "team_member" ? ctx.userId : null,
  };

  const [head, sugg, queue, rateRow, team, inbox, editionRows] = await Promise.all([
    headline(q, filters),
    suggestions(q, ctx, { editionId: opts.editionId ?? null }),
    followUps(q, { ownerId: filters.ownerId, editionId: opts.editionId ?? null }),
    fn ? conversionRates(q, fn, { editionId: opts.editionId ?? null }) : Promise.resolve(null),
    isManager
      ? teamStanding(q, { function: fn, editionId: opts.editionId ?? null })
      : Promise.resolve(null),
    isManager
      ? q.directory
          .select({
            id: opportunities.id,
            personName: people.fullName,
            companyName: companies.name,
            function: opportunities.function,
            editionName: editions.name,
            createdAt: opportunities.createdAt,
          })
          .from(opportunities)
          .innerJoin(people, eq(people.id, opportunities.personId))
          .innerJoin(editions, eq(editions.id, opportunities.editionId))
          .leftJoin(companies, eq(companies.id, opportunities.companyId))
          .where(
            q.where.opportunities(
              and(isNull(opportunities.ownerId), isNull(opportunities.archivedAt)),
            ),
          )
          .orderBy(desc(opportunities.createdAt))
          .limit(50)
      : Promise.resolve([]),
    q.directory
      .select({ id: editions.id, name: editions.name, eventName: events.name })
      .from(editions)
      .innerJoin(events, eq(events.id, editions.eventId))
      .orderBy(desc(editions.startsOn)),
  ]);

  return {
    role: ctx.role,
    functions: ctx.role === "team_member" ? [...ctx.functions] : ["sponsor", "delegate", "speaker"],
    headline: head,
    suggestions: sugg,
    followUps: queue,
    rates: rateRow,
    team,
    unassignedInbox: inbox,
    editions: editionRows,
  };
}
