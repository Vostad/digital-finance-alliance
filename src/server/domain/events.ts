/**
 * EVENTS — "how is this event performing?", and nothing more.
 *
 * Two queries, never one per edition. The obvious implementation asks the
 * headline question once per edition and is fine with three of them; it becomes
 * the slowest screen in the product at thirty.
 *
 * Sponsor money stays sponsor money here exactly as it does on the dashboard:
 * delegate and speaker workstreams carry no revenue in V1, so they are counted,
 * never summed. A "pipeline" that quietly included them would be wrong in a way
 * nobody would notice until it was quoted in a meeting.
 */

import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { editions, events, opportunities } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext } from "../auth/permissions";
import { forbidden } from "../auth/context";

export type EventRow = {
  editionId: string;
  editionName: string;
  eventName: string;
  status: string;
  startsOn: string | null;
  leads: number;
  unassigned: number;
  won: number;
  pipeline: number;
  revenue: number;
  currency: string;
};

export async function eventsOverview(q: ScopedQuery, ctx: AuthContext): Promise<EventRow[]> {
  /* Events is a manager screen. A team member's question is "what is my work",
     which My Leads and My Targets answer. */
  if (ctx.role === "team_member") throw forbidden("You do not have access to this.");

  /* An Admin sees the events they are scoped to and no others. A Super Admin
     has no scope rows and sees everything — the same rule `opportunityScope`
     applies to the rows themselves, kept consistent here for the containers. */
  const scoped = ctx.role !== "super_admin";
  if (scoped && ctx.eventScopeIds.length === 0) return [];

  const editionRows = await q.directory
    .select({
      editionId: editions.id,
      editionName: editions.name,
      eventName: events.name,
      status: editions.status,
      startsOn: editions.startsOn,
    })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(scoped ? inArray(editions.eventId, ctx.eventScopeIds) : undefined)
    .orderBy(desc(editions.startsOn), asc(editions.name));

  if (editionRows.length === 0) return [];

  const stats = await q.directory
    .select({
      editionId: opportunities.editionId,
      leads: sql<number>`count(*)::int`,
      unassigned: sql<number>`count(*) filter (where ${opportunities.ownerId} is null)::int`,
      won: sql<number>`count(*) filter (
        where ${opportunities.wonAt} is not null and ${opportunities.cancelledAt} is null
      )::int`,
      pipeline: sql<string | null>`sum(${opportunities.estimatedValue}) filter (
        where ${opportunities.function} = 'sponsor' and exists (
          select 1 from pipeline_stages ps
          where ps.function = ${opportunities.function} and ps.key = ${opportunities.stageKey} and ps.is_open
        ))`,
      revenue: sql<string | null>`sum(${opportunities.finalValue}) filter (
        where ${opportunities.function} = 'sponsor'
          and ${opportunities.wonAt} is not null and ${opportunities.cancelledAt} is null
      )`,
    })
    .from(opportunities)
    .where(q.where.opportunities())
    .groupBy(opportunities.editionId);

  const byEdition = new Map(stats.map((s) => [s.editionId, s]));

  return editionRows.map((e) => {
    const s = byEdition.get(e.editionId);
    return {
      editionId: e.editionId,
      editionName: e.editionName,
      eventName: e.eventName,
      status: e.status,
      startsOn: e.startsOn ? String(e.startsOn) : null,
      leads: s?.leads ?? 0,
      unassigned: s?.unassigned ?? 0,
      won: s?.won ?? 0,
      pipeline: Number(s?.pipeline ?? 0),
      revenue: Number(s?.revenue ?? 0),
      currency: "USD",
    };
  });
}
