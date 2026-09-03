/**
 * THE PIPELINE VIEW — proving it is a second view of the SAME rows, not a
 * second source of truth.
 *
 * The pipeline is a presentation layer over `pipelineBoard`, which the old
 * dedicated route already used; nothing about the data model changed to bring
 * it back inside Leads. So the guarantees worth pinning are the ones a "view
 * toggle" is easy to get wrong on:
 *
 *   - the sponsor board shows the sponsor stages, in order, and no others;
 *   - delegate and speaker workstreams NEVER appear as sponsor cards, and their
 *     values never price a sponsor column — forcing them into a sponsor ladder
 *     would invent a model the business does not have;
 *   - the list and the pipeline see exactly the same set for the same viewer,
 *     because they run the same scoped predicate. A view that showed more in one
 *     shape than the other would be an authorization leak wearing a layout.
 *
 * One transaction, rolled back.
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
import { pipelineBoard } from "@/server/domain/board";
import { listOpportunities } from "@/server/domain/opportunities";
import { clearPipelineCache } from "@/server/domain/pipeline";
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
  sponsorColumnKeys: string[];
  sponsorCardStages: string[];
  sponsorCardCount: number;
  sponsorColumnValues: (number | null)[];
  listFunctions: string[];
  memberBoardIds: string[];
  memberListSponsorIds: string[];
  delegateBoardCount: number;
  delegateListCount: number;
};

let R: Result;

beforeAll(async () => {
  clearPipelineCache();
  R = await inRollback(async (tx) => {
    const eventId = id();
    const editionId = id();
    const managerId = id();
    const sponsorMemberId = id();
    const delegateMemberId = id();
    const companyId = id();
    const personId = id();

    await tx
      .insert(authUsers)
      .values([{ id: managerId }, { id: sponsorMemberId }, { id: delegateMemberId }]);
    await tx.insert(users).values([
      {
        id: managerId,
        email: "mgr@fixture.test",
        fullName: "Mgr",
        role: "admin",
        status: "active",
      },
      {
        id: sponsorMemberId,
        email: "spo@fixture.test",
        fullName: "Spo",
        role: "team_member",
        status: "active",
      },
      {
        id: delegateMemberId,
        email: "del@fixture.test",
        fullName: "Del",
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

    /* Sponsor work owned by the sponsor member, at two stages, plus delegate
       and speaker work that must NEVER surface on the sponsor board. */
    await tx.insert(opportunities).values([
      {
        id: id(),
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
        function: "sponsor",
        stageKey: "proposal",
        ownerId: sponsorMemberId,
        estimatedValue: "120000",
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
        ownerId: delegateMemberId,
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
        ownerId: delegateMemberId,
        estimatedValue: "888888",
        currency: "USD",
        source: "manual",
      },
    ]);

    const manager = ctxFor("admin", managerId, ["sponsor"], [eventId]);
    const sponsorMember = ctxFor("team_member", sponsorMemberId, ["sponsor"]);
    const delegateMember = ctxFor("team_member", delegateMemberId, ["delegate"]);
    const q = (c: AuthContext) => ({ ...scopedQuery(c), directory: tx }) as never;

    const sponsorBoard = await pipelineBoard(q(manager), "sponsor", {});
    const list = await listOpportunities(q(manager), {}, 100, 0);

    /* The same viewer, both shapes. */
    const memberBoard = await pipelineBoard(q(sponsorMember), "sponsor", {});
    const memberList = await listOpportunities(q(sponsorMember), { function: "sponsor" }, 100, 0);

    /* A delegate-only member on the sponsor board must see nothing of theirs —
       their delegate work is not sponsor pipeline. */
    const delegateOnSponsorBoard = await pipelineBoard(q(delegateMember), "sponsor", {});
    const delegateList = await listOpportunities(q(delegateMember), {}, 100, 0);

    return {
      sponsorColumnKeys: sponsorBoard.columns.map((c) => c.key),
      sponsorCardStages: sponsorBoard.cards.map((c) => c.stageKey),
      sponsorCardCount: sponsorBoard.cards.length,
      sponsorColumnValues: sponsorBoard.columns.map((c) => c.totalValue),
      listFunctions: [...new Set(list.map((r) => r.function))].sort(),
      memberBoardIds: memberBoard.cards.map((c) => c.id).sort(),
      memberListSponsorIds: memberList.map((r) => r.id).sort(),
      delegateBoardCount: delegateOnSponsorBoard.cards.length,
      delegateListCount: delegateList.length,
    };
  });
});

describe("the pipeline view shows the sponsor ladder", () => {
  it("has the nine sponsor stages, in order, as its columns", () => {
    expect(R.sponsorColumnKeys).toEqual([
      "new",
      "contacted",
      "qualified",
      "meeting",
      "proposal",
      "negotiation",
      "won",
      "lost",
      "cancelled",
    ]);
  });

  it("places every card on a sponsor stage", () => {
    expect(R.sponsorCardCount).toBe(2);
    for (const stage of R.sponsorCardStages) {
      expect(R.sponsorColumnKeys).toContain(stage);
    }
    expect(R.sponsorCardStages.sort()).toEqual(["new", "proposal"]);
  });

  it("prices its columns from sponsor money only", () => {
    /* 999,999 (delegate) and 888,888 (speaker) exist in the same edition and
       must not appear in any sponsor column total. */
    const total = R.sponsorColumnValues.reduce<number>((s, v) => s + (v ?? 0), 0);
    expect(total).toBe(170000); // 50,000 + 120,000
    expect(R.sponsorColumnValues).not.toContain(999999);
    expect(R.sponsorColumnValues).not.toContain(888888);
  });
});

describe("delegate and speaker are not sponsor pipeline", () => {
  it("keeps delegate and speaker workstreams off the sponsor board entirely", () => {
    /* The manager's board has exactly the two sponsor cards, so the two
       counted workstreams are absent by construction. */
    expect(R.sponsorCardCount).toBe(2);
  });

  it("shows a delegate-only member nothing on the sponsor board", () => {
    expect(R.delegateBoardCount).toBe(0);
    /* but their own work is still theirs in the list — they own both the
       delegate and the speaker workstream, and the list is ownership-scoped. */
    expect(R.delegateListCount).toBe(2);
  });

  it("still surfaces every function in the LIST view", () => {
    expect(R.listFunctions).toEqual(["delegate", "speaker", "sponsor"]);
  });
});

describe("both views obey the same authorization", () => {
  it("shows a sponsor member the SAME set in list and pipeline", () => {
    /* Same viewer, same scope predicate — the two shapes must not disagree. A
       row visible in one and hidden in the other would be a leak. */
    expect(R.memberBoardIds).toEqual(R.memberListSponsorIds);
    expect(R.memberBoardIds.length).toBe(2);
  });
});
