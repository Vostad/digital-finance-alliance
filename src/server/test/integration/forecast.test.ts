/**
 * FORECAST — §11.
 *
 * Every figure here describes deals that have not happened, except one.
 * `closedRevenue` is the only number in the module that is money the business
 * actually has, and it must exclude cancelled deals. The rest is labelled
 * FORECAST and the tests hold it to that.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { forecast, overriddenOpportunities, overrideProbability } from "@/server/domain/forecast";
import { createLead } from "@/server/domain/leads";
import { changeStage } from "@/server/domain/opportunities";
import { setTarget } from "@/server/domain/targets";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};

beforeAll(async () => {
  await withFixture(async ({ ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin");

    const open = async (name: string, value: string, owner = ids.memberSponsor) => {
      const lead = await createLead(
        sa,
        {
          fullName: name,
          email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.com`,
          functions: ["sponsor"],
          editionId: ids.editionMena,
          estimatedValue: value,
          ownerId: owner,
        },
        saCtx,
      );
      return lead.opportunityIds[0]!;
    };

    await setTarget(
      sa,
      {
        userId: ids.memberSponsor,
        function: "sponsor",
        editionId: ids.editionMena,
        targetValue: "300000.00",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      },
      saCtx,
    );

    /* 100k at PROPOSAL (60%) → 60k weighted.
       50k at NEGOTIATION (80%) → 40k weighted.  Total weighted 100k. */
    const a = await open("Forecast A", "100000.00");
    const b = await open("Forecast B", "50000.00");
    await changeStage(sa, a, { stageKey: "proposal" }, saCtx);
    await changeStage(sa, b, { stageKey: "negotiation" }, saCtx);

    /* Won 70k, and a cancelled 40k that must not appear as revenue. */
    const wonDeal = await open("Forecast Won", "70000.00");
    await changeStage(sa, wonDeal, { stageKey: "won", finalValue: "70000.00" }, saCtx);
    const dead = await open("Forecast Cancelled", "40000.00");
    await changeStage(sa, dead, { stageKey: "won", finalValue: "40000.00" }, saCtx);
    await changeStage(sa, dead, { stageKey: "cancelled", cancellationReasonKey: "deal_collapsed" }, saCtx);

    const base = await forecast(sa, saCtx, { editionId: ids.editionMena });
    R["overall"] = {
      openCount: base.overall.openCount,
      totalPipeline: base.overall.totalPipeline,
      weightedPipeline: base.overall.weightedPipeline,
      weightedAtLadder: base.overall.weightedAtLadder,
      closedRevenue: base.overall.closedRevenue,
      target: base.overall.target,
      remaining: base.overall.remaining,
      forecast: base.overall.forecast,
      overriddenCount: base.overall.overriddenCount,
    };
    R["label"] = base.label;
    R["caveat"] = base.caveat;

    /* ---- §11 the override, recorded ---- */
    const set = await overrideProbability(sa, a, 25, saCtx);
    R["override"] = set;

    const afterOverride = await forecast(sa, saCtx, { editionId: ids.editionMena });
    R["afterOverride"] = {
      weightedPipeline: afterOverride.overall.weightedPipeline,
      weightedAtLadder: afterOverride.overall.weightedAtLadder,
      overriddenCount: afterOverride.overall.overriddenCount,
      overriddenValue: afterOverride.overall.overriddenValue,
      forecast: afterOverride.overall.forecast,
    };

    const listed = await overriddenOpportunities(sa);
    R["overriddenList"] = listed.map((o) => ({
      probability: o.probability,
      ladder: o.ladderProbability,
    }));

    /* Setting it back to the ladder CLEARS the flag rather than recording a
       manual value that happens to match. */
    const cleared = await overrideProbability(sa, a, 60, saCtx);
    R["cleared"] = cleared;
    R["overriddenAfterClear"] = (await overriddenOpportunities(sa)).length;

    /* Out of range is refused. */
    for (const bad of [-1, 101]) {
      try {
        await overrideProbability(sa, a, bad, saCtx);
        R[`range_${bad}`] = false;
      } catch {
        R[`range_${bad}`] = true;
      }
    }

    /* ---- slices ---- */
    R["byEditionCount"] = base.byEdition.length;
    R["byEditionIsThisEdition"] = base.byEdition[0]?.editionId === ids.editionMena;
    R["byOwner"] = base.byOwner.map((o) => ({ name: o.ownerName, forecast: o.forecast }));

    /* ---- scope ---- */
    const asMember = await forecast(q("memberSponsor"), ctx("memberSponsor"), {});
    R["memberSeesOwn"] = asMember.overall.closedRevenue;
    const asOther = await forecast(q("memberDelegate"), ctx("memberDelegate"), {});
    R["nonOwnerSeesNothing"] = {
      closed: asOther.overall.closedRevenue,
      weighted: asOther.overall.weightedPipeline,
      owners: asOther.byOwner.length,
    };

    return true;
  });
});

describe("the §11 figures", () => {
  it("counts only open work as pipeline", () =>
    expect((R["overall"] as Record<string, number>)["openCount"]).toBe(2));

  it("TOTAL PIPELINE is the sum of open estimates", () =>
    expect((R["overall"] as Record<string, number>)["totalPipeline"]).toBe(150000));

  it("WEIGHTED PIPELINE is value × probability — 100k@60% + 50k@80%", () =>
    expect((R["overall"] as Record<string, number>)["weightedPipeline"]).toBe(100000));

  it("CLOSED REVENUE EXCLUDES THE CANCELLED DEAL", () =>
    /* 70k won and 40k won-then-cancelled. Revenue is 70k, never 110k. */
    expect((R["overall"] as Record<string, number>)["closedRevenue"]).toBe(70000));

  it("TARGET and REMAINING come from the target on this slice", () => {
    expect((R["overall"] as Record<string, number>)["target"]).toBe(300000);
    expect((R["overall"] as Record<string, number>)["remaining"]).toBe(230000);
  });

  it("FORECAST is closed revenue plus weighted pipeline", () =>
    expect((R["overall"] as Record<string, number>)["forecast"]).toBe(170000));

  it("is labelled FORECAST and says so in words", () => {
    expect(R["label"]).toBe("FORECAST");
    expect(R["caveat"]).toMatch(/not committed revenue/i);
    expect(R["caveat"]).toMatch(/no part of it is guaranteed/i);
  });
});

describe("§11 — the opportunity-level override is recorded", () => {
  it("nothing is overridden to begin with", () =>
    expect((R["overall"] as Record<string, number>)["overriddenCount"]).toBe(0));

  it("setting one records it", () =>
    expect(R["override"]).toEqual({ probability: 25, overridden: true }));

  it("the weighted total follows the human, not the ladder", () => {
    const after = R["afterOverride"] as Record<string, number>;
    /* 100k drops from 60% to 25% → 25k + 40k = 65k. */
    expect(after["weightedPipeline"]).toBe(65000);
  });

  it("BUT THE LADDER VIEW IS KEPT, so both readings are available", () => {
    const after = R["afterOverride"] as Record<string, number>;
    expect(after["weightedAtLadder"]).toBe(100000);
  });

  it("and how much rests on judgement is quantified", () => {
    const after = R["afterOverride"] as Record<string, number>;
    expect(after["overriddenCount"]).toBe(1);
    expect(after["overriddenValue"]).toBe(100000);
  });

  it("the overridden deals are listable, with the ladder value beside them", () =>
    expect(R["overriddenList"]).toEqual([{ probability: 25, ladder: 60 }]));

  it("SETTING IT BACK TO THE LADDER CLEARS THE FLAG", () => {
    /* Otherwise the count of human-adjusted deals inflates with every deal
       somebody looked at and agreed with. */
    expect(R["cleared"]).toEqual({ probability: 60, overridden: false });
    expect(R["overriddenAfterClear"]).toBe(0);
  });

  it("refuses a probability outside 0–100", () => {
    expect(R["range_-1"]).toBe(true);
    expect(R["range_101"]).toBe(true);
  });
});

describe("slices", () => {
  it("breaks down by edition, skipping empty ones", () => {
    expect(R["byEditionCount"]).toBe(1);
    expect(R["byEditionIsThisEdition"]).toBe(true);
  });
  it("breaks down by owner", () =>
    expect(R["byOwner"]).toEqual([{ name: "Ahmed", forecast: 170000 }]));
});

describe("every figure is confined to the caller's scope", () => {
  it("an owner sees their own closed revenue", () => expect(R["memberSeesOwn"]).toBe(70000));
  it("someone who owns none of it sees zeroes, not everyone's", () =>
    expect(R["nonOwnerSeesNothing"]).toEqual({ closed: 0, weighted: 0, owners: 0 }));
});
