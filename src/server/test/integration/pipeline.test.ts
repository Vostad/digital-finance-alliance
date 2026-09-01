/**
 * §4 PIPELINES — the board, the rates, and D2/D4 proved against real rows.
 *
 * The claim this file exists for: a delegate who attends still counts once, a
 * speaker who withdraws stops counting, and neither contaminates the other's
 * rate.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { conversionRates, MIN_SAMPLE, pipelineBoard } from "@/server/domain/board";
import { logActivity } from "@/server/domain/activities";
import { createLead } from "@/server/domain/leads";
import { ValidationError, changeStage } from "@/server/domain/opportunities";
import { loadWithdrawalReasons } from "@/server/domain/pipeline";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};

beforeAll(async () => {
  await withFixture(async ({ ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin");

    const open = async (name: string, fn: "sponsor" | "delegate" | "speaker", value?: string) => {
      const lead = await createLead(
        sa,
        {
          fullName: name,
          email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.com`,
          functions: [fn],
          editionId: ids.editionMena,
          estimatedValue: value ?? null,
          ownerId: ids.memberSponsor,
        },
        saCtx,
      );
      return lead.opportunityIds[0]!;
    };

    /* ---------------- sponsor board ---------------- */
    const a = await open("Sponsor A", "sponsor", "100000.00");
    const b = await open("Sponsor B", "sponsor", "50000.00");
    const c = await open("Sponsor C", "sponsor", "20000.00");

    await changeStage(sa, a, { stageKey: "proposal" }, saCtx);
    await changeStage(sa, b, { stageKey: "negotiation" }, saCtx);
    await changeStage(sa, c, { stageKey: "lost", lossReasonKey: "price" }, saCtx);

    const sponsorBoard = await pipelineBoard(sa, "sponsor");
    R["sponsorColumnKeys"] = sponsorBoard.columns.map((col) => col.key);
    R["sponsorCounts"] = Object.fromEntries(
      sponsorBoard.columns.filter((col) => col.count > 0).map((col) => [col.key, col.count]),
    );
    R["proposalWeighted"] = sponsorBoard.columns.find(
      (col) => col.key === "proposal",
    )?.weightedValue;
    R["negotiationWeighted"] = sponsorBoard.columns.find(
      (col) => col.key === "negotiation",
    )?.weightedValue;
    R["sponsorCards"] = sponsorBoard.cards.length;

    /* Money is null on a counted board. */
    const delegateBoardEmpty = await pipelineBoard(sa, "delegate");
    R["delegateMoneyIsNull"] = delegateBoardEmpty.columns.every(
      (col) => col.totalValue === null && col.weightedValue === null,
    );

    /* ---------------- D2 · delegate attendance ---------------- */
    const d1 = await open("Delegate One", "delegate");
    const d2 = await open("Delegate Two", "delegate");
    const d3 = await open("Delegate Three", "delegate");

    await changeStage(sa, d1, { stageKey: "confirmed" }, saCtx);
    await changeStage(sa, d2, { stageKey: "confirmed" }, saCtx);
    await changeStage(sa, d3, { stageKey: "declined", lossReasonKey: "not_interested" }, saCtx);

    const beforeAttend = await conversionRates(sa, "delegate");
    R["delegateAchievedBeforeAttending"] = beforeAttend?.achieved;

    /* THE D2 TEST: attending must not change achievement. */
    await changeStage(sa, d1, { stageKey: "attended" }, saCtx);
    const afterAttend = await conversionRates(sa, "delegate");
    R["delegateAchievedAfterAttending"] = afterAttend?.achieved;
    R["delegateAttended"] = afterAttend?.attended;
    R["delegateAttendanceRate"] = afterAttend?.attendanceRate;

    /* ---------------- D4 · speaker attrition ---------------- */
    const s1 = await open("Speaker One", "speaker");
    const s2 = await open("Speaker Two", "speaker");
    const s3 = await open("Speaker Three", "speaker");

    await changeStage(sa, s1, { stageKey: "confirmed" }, saCtx);
    await changeStage(sa, s2, { stageKey: "confirmed" }, saCtx);
    await changeStage(sa, s3, { stageKey: "declined", lossReasonKey: "no_response" }, saCtx);

    const beforeWithdraw = await conversionRates(sa, "speaker");
    R["speakerAchievedBeforeWithdrawal"] = beforeWithdraw?.achieved;
    R["speakerLostBefore"] = beforeWithdraw?.lossRate.numerator;

    /* A withdrawal needs its own reason. */
    try {
      await changeStage(sa, s1, { stageKey: "withdrawn" }, saCtx);
      R["withdrawalWithoutReasonRefused"] = false;
    } catch (error) {
      R["withdrawalWithoutReasonRefused"] = error instanceof ValidationError;
      R["withdrawalMessage"] = (error as Error).message;
    }

    /* A LOSS reason is not a withdrawal reason. */
    const withdrawalReasons = await loadWithdrawalReasons(sa);
    R["withdrawalVocabulary"] = withdrawalReasons.map((w) => w.key).sort();
    R["lossVocabularyIsSeparate"] = !withdrawalReasons.some((w) => w.key.startsWith("withdrew_"));

    /* THE D4 TEST: withdrawing removes achievement WITHOUT becoming a loss. */
    await changeStage(
      sa,
      s1,
      { stageKey: "withdrawn", withdrawalReasonKey: "cannot_travel" },
      saCtx,
    );
    const afterWithdraw = await conversionRates(sa, "speaker");
    R["speakerAchievedAfterWithdrawal"] = afterWithdraw?.achieved;
    R["speakerLostAfter"] = afterWithdraw?.lossRate.numerator;
    R["speakerWithdrawn"] = afterWithdraw?.withdrawn;
    R["speakerAttritionRate"] = afterWithdraw?.attritionRate;

    /* ---------------- §12 · NOT ENOUGH DATA ---------------- */
    R["smallSampleIsNull"] = afterWithdraw?.closeRate.value;
    R["smallSampleStillCounts"] = afterWithdraw?.closeRate.denominator;
    R["minSample"] = MIN_SAMPLE;

    for (let i = 0; i < MIN_SAMPLE; i += 1) {
      const id = await open(`Bulk ${i}`, "sponsor", "10000.00");
      await logActivity(sa, { opportunityId: id, type: "call", notes: "x" }, saCtx);
    }
    const bigSample = await conversionRates(sa, "sponsor");
    R["bigSampleHasValue"] = bigSample?.contactRate.value !== null;
    R["bigSampleDenominator"] = bigSample?.contactRate.denominator;

    /* ---------------- scope ---------------- */
    const memberBoard = await pipelineBoard(q("memberSponsor"), "sponsor");
    R["memberSeesOwnColumnCounts"] = memberBoard.columns.reduce((n, col) => n + col.count, 0);
    const otherBoard = await pipelineBoard(q("memberDelegate"), "sponsor");
    R["nonOwnerSeesNothing"] = otherBoard.columns.reduce((n, col) => n + col.count, 0);

    return true;
  });
});

describe("the sponsor board", () => {
  it("renders every stage as a column, in order", () =>
    expect(R["sponsorColumnKeys"]).toEqual([
      "new",
      "contacted",
      "qualified",
      "meeting",
      "proposal",
      "negotiation",
      "won",
      "lost",
      "cancelled",
    ]));

  it("counts what is in each column", () =>
    expect(R["sponsorCounts"]).toEqual({ proposal: 1, negotiation: 1, lost: 1 }));

  it("weights by the ladder — 100k at 60%, 50k at 80%", () => {
    expect(R["proposalWeighted"]).toBe(60000);
    expect(R["negotiationWeighted"]).toBe(40000);
  });

  it("returns the cards alongside the totals, from one query each", () =>
    expect(R["sponsorCards"]).toBe(3));

  it("a counted board carries no money at all", () => expect(R["delegateMoneyIsNull"]).toBe(true));
});

describe("D2 — a delegate who attends still counts exactly once", () => {
  it("two confirmations are two achievements", () =>
    expect(R["delegateAchievedBeforeAttending"]).toBe(2));

  it("ATTENDING CHANGES NOTHING — still two", () =>
    /* The failure this catches: reading `is_won` on the current stage would
       drop the attendee to one, so achievement would fall the moment someone
       actually turned up. */
    expect(R["delegateAchievedAfterAttending"]).toBe(2));

  it("attendance is reported as its own number", () => expect(R["delegateAttended"]).toBe(1));

  it("measured against those who confirmed, not against everyone", () =>
    expect(R["delegateAttendanceRate"]).toMatchObject({ numerator: 1, denominator: 2 }));
});

describe("D4 — a speaker who withdraws stops counting, without becoming a loss", () => {
  it("two confirmations, one decline", () => {
    expect(R["speakerAchievedBeforeWithdrawal"]).toBe(2);
    expect(R["speakerLostBefore"]).toBe(1);
  });

  it("a withdrawal needs a reason", () => {
    expect(R["withdrawalWithoutReasonRefused"]).toBe(true);
    expect(R["withdrawalMessage"]).toMatch(/withdrawal needs a reason/i);
  });

  it("and the withdrawal vocabulary is its own, not borrowed from loss", () => {
    expect(R["withdrawalVocabulary"]).toEqual([
      "cannot_travel",
      "event_change",
      "internal_change",
      "no_longer_relevant",
      "other",
      "schedule_changed",
    ]);
    expect(R["lossVocabularyIsSeparate"]).toBe(true);
  });

  it("ACHIEVEMENT DROPS to one — they are no longer a confirmed speaker", () =>
    expect(R["speakerAchievedAfterWithdrawal"]).toBe(1));

  it("BUT THE LOSS COUNT IS UNCHANGED — a withdrawal is not a loss", () =>
    /* Both numbers moving would misreport the loss rate and the attrition rate
       at the same time, which is the whole reason D4 exists. */
    expect(R["speakerLostAfter"]).toBe(1));

  it("attrition is reported separately, against those who confirmed", () => {
    expect(R["speakerWithdrawn"]).toBe(1);
    expect(R["speakerAttritionRate"]).toMatchObject({ numerator: 1, denominator: 2 });
  });
});

describe("§12 — NOT ENOUGH DATA is a real answer", () => {
  it("a rate over a small sample returns null rather than a misleading percentage", () =>
    expect(R["smallSampleIsNull"]).toBeNull());

  it("but the raw counts are still returned, so a screen can say why", () =>
    expect(R["smallSampleStillCounts"]).toBeGreaterThan(0));

  it("and a sample at the threshold produces a real number", () => {
    expect(R["bigSampleDenominator"]).toBeGreaterThanOrEqual(R["minSample"] as number);
    expect(R["bigSampleHasValue"]).toBe(true);
  });
});

describe("board figures are aggregated inside the caller's scope", () => {
  it("an owner's column totals are their own work", () =>
    expect(R["memberSeesOwnColumnCounts"]).toBeGreaterThan(0));
  it("someone who owns none of it sees zero, not everyone's", () =>
    expect(R["nonOwnerSeesNothing"]).toBe(0));
});
