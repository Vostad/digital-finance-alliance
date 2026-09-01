/**
 * scopedQuery(ctx) — THE ONLY WAY APPLICATION CODE REACHES THE DATABASE.
 *
 * §37: all writes validate authorization server-side, and never by hiding UI.
 * The way that is made true here is structural rather than disciplinary: the
 * raw `db` handle is banned by eslint outside this directory, so a handler
 * cannot accidentally query unscoped — it has to go out of its way to.
 *
 * The visibility rule, in one place:
 *
 *   Super Admin   every opportunity, every event, no filter
 *   Admin         opportunities in editions of their explicitly scoped events
 *   Team Member   opportunities they own or co-own — nothing else
 *
 * WHAT IS DELIBERATELY NOT SCOPED: people and companies. Any active user can
 * read them, because "NO DUPLICATE PEOPLE" is unachievable otherwise — you
 * cannot be asked to find the existing record before creating one and also be
 * prevented from seeing it. The commercially sensitive part of a relationship
 * is the pipeline attached to it, and that IS scoped.
 */

import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "../db/client";
import { activities, commissionEntries, editions, opportunities } from "../db/schema";
import { forbidden, type AuthError } from "./context";
import {
  canReadOpportunity,
  canWriteOpportunity,
  canViewCommissionFor,
  type AuthContext,
  type OpportunitySubject,
} from "./permissions";

/** `true` and `false` as SQL, so a scope filter is always a composable
    condition and never `undefined` — an undefined `where` returns everything,
    which is the exact failure this whole module exists to prevent. */
const ALL: SQL = sql`true`;
const NONE: SQL = sql`false`;

function opportunityScope(ctx: AuthContext): SQL {
  if (ctx.role === "super_admin") return ALL;

  if (ctx.role === "admin") {
    if (ctx.eventScopeIds.length === 0) return NONE;
    return inArray(
      opportunities.editionId,
      db
        .select({ id: editions.id })
        .from(editions)
        .where(inArray(editions.eventId, [...ctx.eventScopeIds])),
    );
  }

  return or(eq(opportunities.ownerId, ctx.userId), eq(opportunities.secondaryOwnerId, ctx.userId))!;
}

/** Activities inherit their opportunity's visibility exactly. There is no
    activity a person may read on a deal they may not read. */
function activityScope(ctx: AuthContext): SQL {
  if (ctx.role === "super_admin") return ALL;
  return inArray(
    activities.opportunityId,
    db.select({ id: opportunities.id }).from(opportunities).where(opportunityScope(ctx)),
  );
}

/** Own ledger always. Beyond that it is the explicit grant, and for an Admin
    the grant still does not reach outside their event scope. */
function commissionScope(ctx: AuthContext): SQL {
  if (ctx.role === "super_admin") return ALL;

  const own = eq(commissionEntries.userId, ctx.userId);
  if (ctx.role === "team_member" || !ctx.canViewCommission) return own;

  return or(
    own,
    inArray(
      commissionEntries.opportunityId,
      db.select({ id: opportunities.id }).from(opportunities).where(opportunityScope(ctx)),
    ),
  )!;
}

export function scopedQuery(ctx: AuthContext) {
  return {
    ctx,

    /** Conditions to AND into a query. Named `where` because that is where they
        go, and because a bare `scope()` reads like it might do the query. */
    where: {
      opportunities: (extra?: SQL) => and(opportunityScope(ctx), extra ?? ALL)!,
      activities: (extra?: SQL) => and(activityScope(ctx), extra ?? ALL)!,
      commissionEntries: (extra?: SQL) => and(commissionScope(ctx), extra ?? ALL)!,
    },

    /**
     * Row-level checks for the write path. A scoped SELECT proves a row is
     * VISIBLE; it does not prove it is WRITABLE, and the two differ — an
     * unassigned opportunity is visible to an Admin and writable by nobody
     * until it is assigned. Every mutation loads the row and calls these.
     */
    assertCanRead(opp: OpportunitySubject): void {
      if (!canReadOpportunity(ctx, opp)) throw forbidden("You do not have access to this record.");
    },

    assertCanWrite(opp: OpportunitySubject): void {
      if (!canWriteOpportunity(ctx, opp)) throw forbidden("You cannot edit this record.");
    },

    assertCanViewCommissionFor(userId: string): void {
      if (!canViewCommissionFor(ctx, userId)) throw forbidden("Commission is not visible to you.");
    },

    assert(condition: boolean, message?: string): void {
      if (!condition) throw forbidden(message);
    },

    /**
     * THE DIRECTORY TABLES — people, companies, person_emails, company_domains,
     * events, editions, and the reference sets.
     *
     * These carry no row-level scope, and that is a decision rather than an
     * omission: "NO DUPLICATE PEOPLE" is unachievable if you are required to
     * find the existing record before creating one and simultaneously
     * prevented from seeing it. What is commercially sensitive about a
     * relationship is the pipeline attached to it, and that IS scoped, above.
     *
     * Reads through this handle need no further check. WRITES must still be
     * preceded by the relevant assert — creating a person is open to every
     * active user, merging two is not.
     */
    directory: db as DirectoryHandle,

    /**
     * The escape hatch, named so it cannot be used by accident and greps in one
     * search. Legitimate uses: the public form intake, which has no user, and
     * background jobs. Every call site must carry a comment saying why.
     */
    unscoped(reason: string) {
      if (!reason) throw new Error("unscoped() requires a written reason.");
      return db;
    },
  };
}

type Database = typeof db;

/**
 * A connection or a transaction. Every operation the domain layer performs —
 * select, insert, update, and opening a nested transaction — behaves
 * identically on both, and the integration fixture substitutes a transaction
 * so its rows are visible to the code under test and vanish on rollback.
 */
export type DirectoryHandle = Database | Tx;

export type ScopedQuery = ReturnType<typeof scopedQuery>;

/**
 * A Drizzle transaction handle, derived from the real one rather than
 * described by hand. Domain modules take this so a write and its audit row
 * commit together or not at all — and they get it from here rather than from
 * db/client, which eslint keeps out of their reach.
 */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type { AuthError };
