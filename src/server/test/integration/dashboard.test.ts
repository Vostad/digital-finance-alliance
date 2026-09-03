/**
 * THE SIMPLIFIED DASHBOARD AND LEADS LIST — the two guarantees that are easy to
 * get wrong and impossible to see.
 *
 * 1. SPONSOR MONEY IS SPONSOR MONEY. Delegate and speaker workstreams carry no
 *    revenue in V1, so a pipeline figure that summed across every function was
 *    wrong in a way nobody would notice until it was quoted in a meeting. And a
 *    delegate-only coordinator must receive NO money figure at all — not a
 *    zero, which reads as a broken screen, and not somebody else's number.
 *
 *    The assertion is on the PAYLOAD, not the rendering. A card hidden by CSS
 *    has still been sent to the browser.
 *
 * 2. PAGINATION DOES NOT WIDEN SCOPE. Page two must obey the same predicates as
 *    page one. An offset applied outside the scoped predicate is the classic way
 *    a list quietly starts returning other people's rows.
 *
 * Everything runs inside one transaction that is rolled back.
 */

import { TransactionRollbackError, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import {
  authUsers,
  companies,
  editions,
  events,
  opportunities,
  people,
  userEventScopes,
  users,
} from "@/server/db/schema";
import { scopedQuery } from "@/server/auth/scoped";
import { dashboard } from "@/server/domain/dashboard";
import { listOpportunities } from "@/server/domain/opportunities";
import type { AuthContext, Role, WorkFunction } from "@/server/auth/permissions";

const id = () => crypto.randomUUID();

async function inRollback<T>(
  work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
) {
  let out: T | undefined;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local idle_in_transaction_session_timeout = '60s'`);
      out = await work(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
  return out as T;
}

const ctxFor = (
  role: Role,
  userId: string,
  functions: WorkFunction[],
  eventScopeIds: string[] = [],
): AuthContext => ({
  userId,
  email: `${role}@fixture.test`,
  fullName: role,
  role,
  status: "active",
  functions,
  eventScopeIds,
  canViewCommission: false,
  canManageCommissionRules: false,
  timezone: "Asia/Dubai",
});

type Result = {
  managerPipeline: number | null;
  managerRevenue: number | null;
  delegateOnlyPipeline: number | null;
  delegateOnlyRevenue: number | null;
  delegateOnlyPayload: string;
  speakerOnlyShowsMoney: boolean;
  sponsorMemberShowsMoney: boolean;
  page0: string[];
  page1: string[];
  memberPage0: string[];
  memberAllIds: string[];
};

let R: Result;

beforeAll(async () => {
  R = await inRollback(async (tx) => {
    const eventId = id();
    const editionId = id();
    const managerId = id();
    const delegateOnlyId = id();
    const speakerOnlyId = id();
    const sponsorMemberId = id();
    const companyId = id();
    const personId = id();

    await tx
      .insert(authUsers)
      .values([
        { id: managerId },
        { id: delegateOnlyId },
        { id: speakerOnlyId },
        { id: sponsorMemberId },
      ]);
    await tx.insert(users).values([
      {
        id: managerId,
        email: "mgr@fixture.test",
        fullName: "Mgr",
        role: "admin",
        status: "active",
      },
      {
        id: delegateOnlyId,
        email: "del@fixture.test",
        fullName: "Del",
        role: "team_member",
        status: "active",
      },
      {
        id: speakerOnlyId,
        email: "spk@fixture.test",
        fullName: "Spk",
        role: "team_member",
        status: "active",
      },
      {
        id: sponsorMemberId,
        email: "spo@fixture.test",
        fullName: "Spo",
        role: "team_member",
        status: "active",
      },
    ]);

    await tx.insert(events).values([{ id: eventId, name: "E", slug: `e-${eventId.slice(0, 8)}` }]);
    await tx.insert(editions).values([{ id: editionId, eventId, name: "E 2026", slug: "2026" }]);
    await tx.insert(userEventScopes).values([{ userId: managerId, eventId }]);

    await tx.insert(companies).values([{ id: companyId, name: "Co", normalizedName: "co" }]);
    await tx
      .insert(people)
      .values([{ id: personId, companyId, fullName: "P", normalizedName: "p" }]);

    /* One sponsor deal worth money, plus delegate and speaker workstreams that
       carry values they must NEVER contribute to a money figure. */
    const sponsorWon = id();
    const sponsorOpen = id();
    await tx.insert(opportunities).values([
      {
        id: sponsorWon,
        personId,
        companyId,
        editionId,
        function: "sponsor",
        stageKey: "won",
        ownerId: sponsorMemberId,
        estimatedValue: "100000",
        finalValue: "250000",
        currency: "USD",
        wonAt: new Date(),
        source: "manual",
      },
      {
        id: sponsorOpen,
        personId,
        companyId,
        editionId,
        function: "sponsor",
        stageKey: "new",
        ownerId: sponsorMemberId,
        estimatedValue: "50000",
        currency: "USD",
        source: "manual",
      },
      {
        id: id(),
        personId,
        companyId,
        editionId,
        function: "delegate",
        stageKey: "new",
        ownerId: delegateOnlyId,
        estimatedValue: "999999",
        currency: "USD",
        source: "manual",
      },
      {
        id: id(),
        personId,
        companyId,
        editionId,
        function: "speaker",
        stageKey: "new",
        ownerId: speakerOnlyId,
        estimatedValue: "888888",
        currency: "USD",
        source: "manual",
      },
    ]);

    /* The scope lives in ctx, exactly as `loadContext` builds it from the
       rows inserted above. An empty scope would legitimately see nothing. */
    const manager = ctxFor("admin", managerId, ["sponsor"], [eventId]);
    const delegateOnly = ctxFor("team_member", delegateOnlyId, ["delegate"]);
    const speakerOnly = ctxFor("team_member", speakerOnlyId, ["speaker"]);
    const sponsorMember = ctxFor("team_member", sponsorMemberId, ["sponsor"]);
    const q = (c: AuthContext) => ({ ...scopedQuery(c), directory: tx }) as never;

    const mgrView = await dashboard(q(manager), manager);
    const delView = await dashboard(q(delegateOnly), delegateOnly);
    const spkView = await dashboard(q(speakerOnly), speakerOnly);
    const spoView = await dashboard(q(sponsorMember), sponsorMember);

    const p0 = await listOpportunities(q(manager), {}, 2, 0);
    const p1 = await listOpportunities(q(manager), {}, 2, 2);
    const memberPage = await listOpportunities(q(delegateOnly), {}, 2, 0);
    const memberAll = await listOpportunities(q(delegateOnly), {}, 100, 0);

    return {
      managerPipeline: mgrView.headline.totalPipeline,
      managerRevenue: mgrView.headline.closedRevenue,
      delegateOnlyPipeline: delView.headline.totalPipeline,
      delegateOnlyRevenue: delView.headline.closedRevenue,
      delegateOnlyPayload: JSON.stringify(delView),
      speakerOnlyShowsMoney: spkView.showSponsorMoney,
      sponsorMemberShowsMoney: spoView.showSponsorMoney,
      page0: p0.map((r) => r.id),
      page1: p1.map((r) => r.id),
      memberPage0: memberPage.map((r) => r.id),
      memberAllIds: memberAll.map((r) => r.id),
    };
  });
});

describe("sponsor money is sponsor money", () => {
  it("sums only sponsor workstreams into pipeline", () => {
    /* The delegate row carries 999,999 and the speaker row 888,888. Neither may
       appear. Sponsor open work is 50,000 and that is the whole figure. */
    expect(R.managerPipeline).toBe(50000);
  });

  it("sums only sponsor workstreams into revenue", () => {
    expect(R.managerRevenue).toBe(250000);
  });

  it("sends a delegate-only person NO money figure — absent, not zero", () => {
    expect(R.delegateOnlyPipeline).toBeNull();
    expect(R.delegateOnlyRevenue).toBeNull();
  });

  it("puts no sponsor figure anywhere in a delegate-only payload", () => {
    /* Not "hidden by the component" — never sent. */
    expect(R.delegateOnlyPayload).not.toContain("250000");
    expect(R.delegateOnlyPayload).not.toContain("50000");
  });

  it("omits the money cards for a speaker-only person too", () => {
    expect(R.speakerOnlyShowsMoney).toBe(false);
  });

  it("still shows them to someone who does sponsor work", () => {
    expect(R.sponsorMemberShowsMoney).toBe(true);
  });
});

describe("pagination does not widen scope", () => {
  it("returns different rows on different pages", () => {
    expect(R.page0).toHaveLength(2);
    expect(R.page0).not.toEqual(R.page1);
  });

  it("never repeats a row across page boundaries", () => {
    expect(R.page0.filter((x) => R.page1.includes(x))).toEqual([]);
  });

  it("keeps a team member's page inside their own rows", () => {
    /* A delegate-only member owns exactly one workstream. Page one of two must
       still be that one row — an offset applied outside the scope predicate is
       how a list starts leaking. */
    expect(R.memberAllIds).toHaveLength(1);
    expect(R.memberPage0).toEqual(R.memberAllIds);
  });
});
