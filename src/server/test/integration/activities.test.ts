/**
 * ACTIVITY AND FOLLOW-UPS — §8, §12, and §39 scenarios 4, 5, 9, 25.
 *
 * The two properties: the timeline is append-only and cannot be fabricated,
 * and the follow-up queue buckets correctly against real dates.
 */

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { activities, opportunities } from "@/server/db/schema";
import {
  attentionNeeded,
  followUps,
  logActivity,
  setNextAction,
  timeline,
} from "@/server/domain/activities";
import { assignOwner } from "@/server/domain/assignment";
import { createLead } from "@/server/domain/leads";
import { changeStage, listOpportunities } from "@/server/domain/opportunities";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};
const days = (n: number) => new Date(Date.now() + n * 86_400_000);

beforeAll(async () => {
  await withFixture(async ({ tx, ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin");

    const lead = await createLead(
      sa,
      {
        fullName: "John Smith",
        companyName: "ABC Bank",
        email: "john.smith@abcbank.com",
        functions: ["sponsor"],
        editionId: ids.editionMena,
        estimatedValue: "90000.00",
      },
      saCtx,
    );
    const oppId = lead.opportunityIds[0]!;
    await assignOwner(sa, oppId, ids.memberSponsor, saCtx);

    const member = q("memberSponsor");
    const memberCtx = ctx("memberSponsor");

    /* The owner logs real work. */
    await logActivity(
      member,
      {
        opportunityId: oppId,
        type: "call",
        notes: "Intro call.",
        nextAction: "Send deck",
        nextActionDueAt: days(-2),
      },
      memberCtx,
    );
    await logActivity(
      member,
      { opportunityId: oppId, type: "email", notes: "Sent deck." },
      memberCtx,
    );
    await logActivity(
      member,
      { opportunityId: oppId, type: "meeting", notes: "Met in Dubai.", occurredAt: days(-1) },
      memberCtx,
    );

    const t = await timeline(member, oppId);
    R["timelineLength"] = t.length;
    R["timelineTypes"] = t.map((a) => a.type);
    R["timelineActors"] = Object.fromEntries(t.map((a) => [a.type, a.userName]));

    /* System-written types cannot be hand-logged — that would let someone
       fabricate a stage history. */
    for (const type of ["status_change", "assignment"] as const) {
      try {
        await logActivity(member, { opportunityId: oppId, type }, memberCtx);
        R[`hand_${type}`] = true;
      } catch {
        R[`hand_${type}`] = false;
      }
    }

    /* Nothing can be recorded in the future. */
    try {
      await logActivity(
        member,
        { opportunityId: oppId, type: "call", occurredAt: days(3) },
        memberCtx,
      );
      R["futureAllowed"] = true;
    } catch {
      R["futureAllowed"] = false;
    }

    /* A colleague who does not own it cannot log against it. */
    try {
      await logActivity(
        q("memberDelegate"),
        { opportunityId: oppId, type: "note", notes: "sneaky" },
        ctx("memberDelegate"),
      );
      R["strangerCouldLog"] = true;
    } catch {
      R["strangerCouldLog"] = false;
    }

    /* There is NO update or delete path in the module at all. */
    R["moduleExports"] = Object.keys(await import("@/server/domain/activities")).sort();

    /* ---- the follow-up queue ---- */
    const overdueOpp = oppId;
    const todayLead = await createLead(
      sa,
      { fullName: "Due Today", functions: ["sponsor"], editionId: ids.editionMena },
      saCtx,
    );
    const soonLead = await createLead(
      sa,
      { fullName: "Due Soon", functions: ["sponsor"], editionId: ids.editionMena },
      saCtx,
    );
    const noneLead = await createLead(
      sa,
      { fullName: "No Follow Up", functions: ["sponsor"], editionId: ids.editionMena },
      saCtx,
    );

    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    await setNextAction(
      sa,
      todayLead.opportunityIds[0]!,
      { nextAction: "Call back", nextActionDueAt: today },
      saCtx,
    );
    await setNextAction(
      sa,
      soonLead.opportunityIds[0]!,
      { nextAction: "Proposal", nextActionDueAt: days(3) },
      saCtx,
    );

    const queue = await followUps(sa);
    R["overdue"] = queue.overdue.length;
    R["dueToday"] = queue.today.length;
    R["upcoming"] = queue.upcoming.length;
    R["overdueIsTheRightOne"] = queue.overdue[0]?.id === overdueOpp;

    /* A closed workstream drops out of the queue entirely. */
    await changeStage(
      sa,
      soonLead.opportunityIds[0]!,
      { stageKey: "lost", lossReasonKey: "budget" },
      saCtx,
    );
    const afterClose = await followUps(sa);
    R["upcomingAfterClose"] = afterClose.upcoming.length;

    /* The owner's own queue contains only their work. */
    const memberQueue = await followUps(member, { ownerId: ids.memberSponsor });
    R["memberQueueTotal"] =
      memberQueue.overdue.length + memberQueue.today.length + memberQueue.upcoming.length;

    /* ---- attention needed ---- */
    const attention = await attentionNeeded(sa);
    R["noFollowUpCount"] = attention.noFollowUp.length;
    R["noFollowUpIncludesTheRightOne"] = attention.noFollowUp
      .map((a) => a.id)
      .includes(noneLead.opportunityIds[0]!);
    R["neverContactedCount"] = attention.neverContacted.length;
    R["contactedOneIsExcluded"] = !attention.neverContacted.map((a) => a.id).includes(oppId);

    /* Activity rows survive a stage change — the history is not rewritten. */
    await changeStage(sa, oppId, { stageKey: "meeting" }, saCtx);
    const stillThere = await tx
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.opportunityId, oppId));
    R["activitiesAfterStageChange"] = stillThere.length;

    const openCount = await listOpportunities(sa);
    R["openTotal"] = openCount.length;
    R["opportunityTableIntact"] = (
      await tx.select({ id: opportunities.id }).from(opportunities)
    ).length;

    return true;
  });
});

describe("the timeline records real work", () => {
  it("keeps every entry, including the ones the system wrote", () =>
    /* three logged by the owner, plus the assignment §9 lists as an activity
       type in its own right. */
    expect(R["timelineLength"]).toBe(4));

  it("orders by when it HAPPENED, not when it was typed", () =>
    /* The meeting was logged last but occurred yesterday, so it sorts last.
       That distinction is the reason occurred_at exists separately from
       created_at — response-time metrics are meaningless otherwise. */
    expect(R["timelineTypes"]).toEqual(["email", "call", "assignment", "meeting"]));

  it("names who did each thing", () =>
    expect(R["timelineActors"]).toEqual({
      call: "Ahmed",
      email: "Ahmed",
      meeting: "Ahmed",
      assignment: "Super Admin",
    }));
});

describe("the timeline cannot be fabricated", () => {
  it("status_change cannot be hand-logged", () => expect(R["hand_status_change"]).toBe(false));
  it("assignment cannot be hand-logged", () => expect(R["hand_assignment"]).toBe(false));
  it("nothing can be recorded as happening in the future", () =>
    expect(R["futureAllowed"]).toBe(false));
  it("someone who does not own the workstream cannot log against it", () =>
    expect(R["strangerCouldLog"]).toBe(false));
});

describe("the timeline is APPEND-ONLY by construction", () => {
  it("the module exposes no update or delete path at all", () => {
    const exports = R["moduleExports"] as string[];
    expect(exports.some((e) => /delete|remove|update|edit/i.test(e))).toBe(false);
  });
  it("activity survives a stage change", () =>
    /* 3 logged by the owner + 1 assignment + 1 status_change. Nothing is
       rewritten and nothing is removed. */
    expect(R["activitiesAfterStageChange"]).toBe(5));
});

describe("the follow-up queue", () => {
  it("buckets overdue", () => expect(R["overdue"]).toBe(1));
  it("buckets due today", () => expect(R["dueToday"]).toBe(1));
  it("buckets upcoming", () => expect(R["upcoming"]).toBe(1));
  it("puts the right record in overdue", () => expect(R["overdueIsTheRightOne"]).toBe(true));
  it("DROPS a workstream once it closes — closed work has no follow-up", () =>
    expect(R["upcomingAfterClose"]).toBe(0));
  it("an owner's queue contains only their own work", () => expect(R["memberQueueTotal"]).toBe(1));
});

describe("what needs attention, from real records only", () => {
  it("finds open work with no follow-up set", () => {
    expect(R["noFollowUpCount"]).toBeGreaterThan(0);
    expect(R["noFollowUpIncludesTheRightOne"]).toBe(true);
  });
  it("finds work never actually contacted", () =>
    expect(R["neverContactedCount"]).toBeGreaterThan(0));
  it("and excludes the one that WAS contacted", () =>
    expect(R["contactedOneIsExcluded"]).toBe(true));
});
