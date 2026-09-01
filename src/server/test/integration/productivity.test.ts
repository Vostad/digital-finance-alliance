/**
 * PRODUCTIVITY — §12.
 *
 * Two properties. Every metric refuses to divide below the sample threshold
 * and says so; and every insight names the exact rows it counted, so a
 * suggestion can be checked rather than believed.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { logActivity } from "@/server/domain/activities";
import { createLead } from "@/server/domain/leads";
import { changeStage } from "@/server/domain/opportunities";
import { insights, metrics } from "@/server/domain/productivity";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};

beforeAll(async () => {
  await withFixture(async ({ ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin");

    const open = async (name: string, value: string) => {
      const lead = await createLead(
        sa,
        {
          fullName: name,
          email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.com`,
          functions: ["sponsor"],
          editionId: ids.editionMena,
          estimatedValue: value,
          ownerId: ids.memberSponsor,
        },
        saCtx,
      );
      return lead.opportunityIds[0]!;
    };

    /* ---- a small sample first: the refusal must fire ---- */
    const first = await open("Small Sample", "10000.00");
    await logActivity(sa, { opportunityId: first, type: "call", notes: "x" }, saCtx);
    const small = await metrics(sa, "sponsor");
    R["smallSample"] = small.metrics.map((m) => ({ key: m.key, value: m.value }));
    R["smallSampleKeepsCounts"] = small.metrics.find((m) => m.key === "contact");
    R["minSample"] = small.minSample;

    /* ---- grow past the threshold ---- */
    const ids_: string[] = [first];
    for (let i = 0; i < 12; i += 1) ids_.push(await open(`Bulk ${i}`, `${(i + 1) * 10000}.00`));

    /* Contact 10 of 13; meet 6; propose 3; win 2. */
    for (const id of ids_.slice(0, 10)) {
      await logActivity(sa, { opportunityId: id, type: "call", notes: "called" }, saCtx);
    }
    for (const id of ids_.slice(0, 6)) {
      await logActivity(sa, { opportunityId: id, type: "meeting", notes: "met" }, saCtx);
    }
    for (const id of ids_.slice(0, 3)) {
      await logActivity(sa, { opportunityId: id, type: "proposal", notes: "sent" }, saCtx);
    }
    await changeStage(sa, ids_[0]!, { stageKey: "won", finalValue: "40000.00" }, saCtx);
    await changeStage(sa, ids_[1]!, { stageKey: "won", finalValue: "60000.00" }, saCtx);
    await changeStage(sa, ids_[2]!, { stageKey: "lost", lossReasonKey: "price" }, saCtx);

    const big = await metrics(sa, "sponsor");
    const byKey = Object.fromEntries(big.metrics.map((m) => [m.key, m]));
    R["total"] = big.total;
    R["contact"] = {
      v: byKey["contact"]!.value,
      n: byKey["contact"]!.numerator,
      d: byKey["contact"]!.denominator,
    };
    R["meetingBasis"] = byKey["meeting"]!.basis;
    R["proposalBasis"] = byKey["proposal"]!.basis;
    R["rejectionBasis"] = byKey["rejection"]!.basis;
    R["rejection"] = { n: byKey["rejection"]!.numerator, d: byKey["rejection"]!.denominator };
    R["metricKeys"] = big.metrics.map((m) => m.key);
    R["avgDealBelowSample"] = byKey["avgDeal"]!.value;

    /* ---- function-specific metrics appear only for their function ---- */
    R["sponsorHasNoAttrition"] = !byKey["attrition"];
    const speakerMetrics = await metrics(sa, "speaker");
    R["speakerHasAttrition"] = speakerMetrics.metrics.some((m) => m.key === "attrition");
    R["speakerHasNoDealSize"] = !speakerMetrics.metrics.some((m) => m.key === "avgDeal");
    const delegateMetrics = await metrics(sa, "delegate");
    R["delegateHasAttendance"] = delegateMetrics.metrics.some((m) => m.key === "attendance");

    /* ---- insights trace to real rows ---- */
    const list = await insights(sa, saCtx);
    R["insightIds"] = list.map((i) => i.id).sort();
    R["everyInsightNamesItsRows"] = list.every(
      (i) => i.opportunityIds.length === i.count && i.count > 0,
    );
    R["uncontacted"] = list.find((i) => i.id === "uncontacted")?.count;

    const contactedSet = new Set(ids_.slice(0, 10));
    const uncontactedInsight = list.find((i) => i.id === "uncontacted");
    R["uncontactedRowsAreActuallyUncontacted"] =
      uncontactedInsight?.opportunityIds.every((id) => !contactedSet.has(id)) ?? false;

    /* ---- scoped ---- */
    R["nonOwnerInsights"] = (await insights(q("memberDelegate"), ctx("memberDelegate"))).length;
    const memberMetrics = await metrics(q("memberDelegate"), "sponsor");
    R["nonOwnerTotal"] = memberMetrics.total;

    return true;
  });
});

describe("§12 — NOT ENOUGH DATA is a real answer", () => {
  it("every rate refuses to divide below the threshold", () =>
    expect((R["smallSample"] as { value: number | null }[]).every((m) => m.value === null)).toBe(
      true,
    ));

  it("but the raw counts come back anyway, so a screen can show its working", () =>
    expect(R["smallSampleKeepsCounts"]).toMatchObject({ numerator: 1, denominator: 1 }));

  it("the threshold is stated rather than hidden", () => expect(R["minSample"]).toBe(10));
});

describe("the metrics themselves", () => {
  it("computes over every workstream in scope", () => expect(R["total"]).toBe(13));

  it("contact rate is contacted over all — 10 of 13", () =>
    expect(R["contact"]).toEqual({ v: 10 / 13, n: 10, d: 13 }));

  it("DENOMINATORS DIFFER, and each says what it is", () => {
    /* A response rate over every opportunity rather than over those actually
       contacted flatters the team by counting people they never called. */
    expect(R["meetingBasis"]).toBe("of those contacted");
    expect(R["proposalBasis"]).toBe("of those met");
    expect(R["rejectionBasis"]).toBe("of those that reached an outcome");
  });

  it("rejection rate is losses over outcomes — 1 of 3", () =>
    expect(R["rejection"]).toEqual({ n: 1, d: 3 }));

  it("covers everything §12 names", () =>
    expect(R["metricKeys"]).toEqual([
      "contact",
      "response",
      "meeting",
      "proposal",
      "close",
      "rejection",
      "avgDeal",
      "timeToClose",
      "velocity",
    ]));

  it("average deal size still refuses below the sample — 2 wins is not a distribution", () =>
    expect(R["avgDealBelowSample"]).toBeNull());
});

describe("function-specific metrics appear only where they mean something", () => {
  it("sponsor has no attrition rate", () => expect(R["sponsorHasNoAttrition"]).toBe(true));
  it("speaker has attrition", () => expect(R["speakerHasAttrition"]).toBe(true));
  it("speaker has no deal size — speakers are not priced", () =>
    expect(R["speakerHasNoDealSize"]).toBe(true));
  it("delegate has attendance", () => expect(R["delegateHasAttendance"]).toBe(true));
});

describe("insights are deterministic and traceable", () => {
  it("every insight carries exactly the ids it counted", () =>
    expect(R["everyInsightNamesItsRows"]).toBe(true));

  it("finds the uncontacted work", () => expect(R["uncontacted"]).toBe(3));

  it("AND THE ROWS IT NAMES ARE ACTUALLY UNCONTACTED", () =>
    /* A suggestion you cannot check is a suggestion you have to believe. */
    expect(R["uncontactedRowsAreActuallyUncontacted"]).toBe(true));

  it("surfaces the categories §12 asks for", () =>
    expect(R["insightIds"]).toContain("high-value-no-follow-up"));
});

describe("everything is confined to the caller's scope", () => {
  it("someone who owns none of it gets no insights", () => expect(R["nonOwnerInsights"]).toBe(0));
  it("and no metrics either", () => expect(R["nonOwnerTotal"]).toBe(0));
});
