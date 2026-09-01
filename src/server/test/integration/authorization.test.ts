/**
 * SERVER-SIDE AUTHORIZATION, PROVED AGAINST POSTGRES.
 *
 * The unit suite proves the rules and the SQL they compile to. This proves the
 * last step: that the SQL, executed by the real database against real rows,
 * returns what the rules say it should. A filter can be correct on paper and
 * still return the wrong set — a subquery that matches nothing, an OR that
 * binds loosely, a NULL comparison that quietly drops a row.
 *
 * EVERYTHING RUNS INSIDE ONE TRANSACTION THAT IS ROLLED BACK. Not a row of this
 * fixture is committed. The database ends the run exactly as it started, which
 * is why realistic-looking deals here can never be mistaken for real history.
 *
 * The ephemeral auth.users rows exist only because public.users.id carries a
 * foreign key onto them; they hold nothing but an id and they vanish with the
 * rollback.
 */

import { TransactionRollbackError, and, eq, isNull, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import {
  activities,
  authUsers,
  commissionEntries,
  companies,
  editions,
  events,
  opportunities,
  people,
  userEventScopes,
  users,
} from "@/server/db/schema";
import { scopedQuery } from "@/server/auth/scoped";
import type { AuthContext, Role } from "@/server/auth/permissions";

const id = () => crypto.randomUUID();

type Counts = Record<string, number>;
const visible: Counts = {};
const commission: Counts = {};
const activityCounts: Counts = {};
let unassignedForAdmin = 0;
const committedRowsAfter: Counts = {};
/** Sampled BEFORE the fixture runs, so the post-rollback comparison measures
    what the fixture did rather than what the migrations seeded. */
let eventsBefore = -1;

/** Run work inside a transaction and roll it back, returning its result. */
async function inRollback<T>(
  work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
) {
  let out: T | undefined;
  try {
    await db.transaction(async (tx) => {
      out = await work(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
  return out as T;
}

function ctxFor(role: Role, userId: string, scopeIds: string[], grant = false): AuthContext {
  return {
    userId,
    email: `${role}@fixture.test`,
    fullName: role,
    role,
    status: "active",
    functions: ["sponsor"],
    eventScopeIds: scopeIds,
    canViewCommission: grant,
    canManageCommissionRules: false,
    timezone: "Asia/Dubai",
  };
}

beforeAll(async () => {
  const baseline = await db.select({ n: sql<number>`count(*)::int` }).from(events);
  eventsBefore = baseline[0]?.n ?? -1;

  await inRollback(async (tx) => {
    const eventMena = id();
    const eventAsia = id();
    const editionMena = id();
    const editionAsia = id();
    const superId = id();
    const adminId = id();
    const memberId = id();
    const otherId = id();
    const companyId = id();
    const personId = id();

    await tx
      .insert(authUsers)
      .values([{ id: superId }, { id: adminId }, { id: memberId }, { id: otherId }]);
    await tx.insert(users).values([
      {
        id: superId,
        email: "s@fixture.test",
        fullName: "Super",
        role: "super_admin",
        status: "active",
      },
      { id: adminId, email: "a@fixture.test", fullName: "Admin", role: "admin", status: "active" },
      {
        id: memberId,
        email: "m@fixture.test",
        fullName: "Member",
        role: "team_member",
        status: "active",
      },
      {
        id: otherId,
        email: "o@fixture.test",
        fullName: "Other",
        role: "team_member",
        status: "active",
      },
    ]);

    await tx.insert(events).values([
      { id: eventMena, name: "MENA", slug: `mena-${eventMena.slice(0, 8)}` },
      { id: eventAsia, name: "Asia", slug: `asia-${eventAsia.slice(0, 8)}` },
    ]);
    await tx.insert(editions).values([
      { id: editionMena, eventId: eventMena, name: "MENA 2026", slug: "2026" },
      { id: editionAsia, eventId: eventAsia, name: "Asia 2026", slug: "2026" },
    ]);

    /* The Admin is scoped to MENA only, explicitly. Never inferred. */
    await tx.insert(userEventScopes).values([{ userId: adminId, eventId: eventMena }]);

    await tx
      .insert(companies)
      .values([{ id: companyId, name: "Fixture Co", normalizedName: "fixture co" }]);
    await tx
      .insert(people)
      .values([
        { id: personId, companyId, fullName: "Fixture Person", normalizedName: "fixture person" },
      ]);

    const oppOwned = id();
    const oppShared = id();
    const oppUnassigned = id();
    const oppAsia = id();
    const base = { personId, companyId, function: "sponsor" as const, stageKey: "new" };

    await tx.insert(opportunities).values([
      { id: oppOwned, ...base, editionId: editionMena, ownerId: memberId },
      {
        id: oppShared,
        ...base,
        editionId: editionMena,
        ownerId: otherId,
        secondaryOwnerId: memberId,
        ownerSplitPct: 60,
        secondarySplitPct: 40,
      },
      { id: oppUnassigned, ...base, editionId: editionMena, ownerId: null },
      { id: oppAsia, ...base, editionId: editionAsia, ownerId: otherId },
    ]);

    await tx.insert(activities).values([
      { opportunityId: oppOwned, userId: memberId, type: "call", notes: "fixture" },
      { opportunityId: oppAsia, userId: otherId, type: "call", notes: "fixture" },
    ]);

    await tx.insert(commissionEntries).values([
      {
        opportunityId: oppOwned,
        userId: memberId,
        entryType: "earned",
        lockedBasis: "percentage",
        lockedRatePct: "10.000",
        baseValue: "10000.00",
        amount: "1000.00",
        currency: "USD",
      },
      {
        opportunityId: oppAsia,
        userId: otherId,
        entryType: "earned",
        lockedBasis: "percentage",
        lockedRatePct: "10.000",
        baseValue: "20000.00",
        amount: "2000.00",
        currency: "USD",
      },
    ]);

    const contexts: Array<[string, AuthContext]> = [
      ["super", ctxFor("super_admin", superId, [])],
      ["admin", ctxFor("admin", adminId, [eventMena])],
      ["adminNoScope", ctxFor("admin", adminId, [])],
      ["member", ctxFor("team_member", memberId, [])],
      ["other", ctxFor("team_member", otherId, [])],
      ["adminWithGrant", ctxFor("admin", adminId, [eventMena], true)],
    ];

    for (const [label, ctx] of contexts) {
      const q = scopedQuery(ctx);
      const rows = await tx
        .select({ id: opportunities.id })
        .from(opportunities)
        .where(q.where.opportunities());
      visible[label] = rows.length;

      const acts = await tx
        .select({ id: activities.id })
        .from(activities)
        .where(q.where.activities());
      activityCounts[label] = acts.length;

      const comm = await tx
        .select({ id: commissionEntries.id })
        .from(commissionEntries)
        .where(q.where.commissionEntries());
      commission[label] = comm.length;
    }

    /* The Super Admin inbox, as the scoped query actually expresses it. */
    const adminQ = scopedQuery(ctxFor("admin", adminId, [eventMena]));
    const inbox = await tx
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(and(adminQ.where.opportunities(), isNull(opportunities.ownerId)));
    unassignedForAdmin = inbox.length;

    return true;
  });

  /* After the rollback: prove the fixture left every table as it found it. */
  for (const [label, table] of [
    ["opportunities", opportunities],
    ["people", people],
    ["companies", companies],
    ["events", events],
    ["commission_entries", commissionEntries],
  ] as const) {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
    committedRowsAfter[label] = row?.n ?? -1;
  }
});

describe("opportunity visibility, executed by Postgres", () => {
  it("Super Admin sees every opportunity, in every event", () => {
    expect(visible["super"]).toBe(4);
  });

  it("an Admin sees only their scoped event — 3 of 4", () => {
    expect(visible["admin"]).toBe(3);
  });

  it("AN ADMIN WITH NO SCOPE SEES NOTHING — the empty list is not a wildcard", () => {
    expect(visible["adminNoScope"]).toBe(0);
  });

  it("a Team Member sees what they own and co-own — 2 of 4", () => {
    expect(visible["member"]).toBe(2);
  });

  it("a Team Member does not see the unassigned lead", () => {
    /* other owns the Asia deal and the shared MENA deal; neither is unassigned. */
    expect(visible["other"]).toBe(2);
  });

  it("the unassigned inbox resolves for an Admin in scope", () => {
    expect(unassignedForAdmin).toBe(1);
  });
});

describe("activities inherit opportunity visibility", () => {
  it("Super Admin sees both", () => expect(activityCounts["super"]).toBe(2));
  it("a Team Member sees only the one on their own deal", () =>
    expect(activityCounts["member"]).toBe(1));
  it("an Admin scoped to MENA does not see the Asia activity", () =>
    expect(activityCounts["admin"]).toBe(1));
});

describe("commission visibility", () => {
  it("Super Admin sees every entry", () => expect(commission["super"]).toBe(2));
  it("a Team Member sees only their own", () => expect(commission["member"]).toBe(1));
  it("an Admin WITHOUT the grant sees only their own — here, none", () =>
    expect(commission["admin"]).toBe(0));
  it("the grant widens it to their scoped events, not to everything", () =>
    expect(commission["adminWithGrant"]).toBe(1));
});

describe("the fixture left nothing behind", () => {
  it.each([["opportunities"], ["people"], ["companies"], ["commission_entries"]])(
    "%s is still empty after rollback",
    (table) => {
      expect(committedRowsAfter[table]).toBe(0);
    },
  );

  it("events is UNCHANGED — it holds the seeded calendar, which is configuration", () => {
    /* Not weakened: the fixture inserts two events of its own, so if the
       rollback had failed this count would be higher. It just measures against
       the right baseline instead of assuming the table starts empty. */
    expect(committedRowsAfter["events"]).toBe(eventsBefore);
  });
});
