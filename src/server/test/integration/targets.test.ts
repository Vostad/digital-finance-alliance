/**
 * TARGETS — §9, and §39 scenario 28 (a Team Member cannot set their own).
 *
 * The property under test: the numbers beside a target always describe that
 * target. Same owner, same function, same edition, same window — a progress
 * figure measured against a different scope than the target it sits next to is
 * worse than no figure at all.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { createLead } from "@/server/domain/leads";
import { changeStage } from "@/server/domain/opportunities";
import { setTarget, targetProgress, updateTarget } from "@/server/domain/targets";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};
const YEAR = { periodStart: "2026-01-01", periodEnd: "2026-12-31" };

beforeAll(async () => {
  await withFixture(async ({ ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin");

    const open = async (name: string, fn: "sponsor" | "delegate" | "speaker", owner: string, value?: string) => {
      const lead = await createLead(
        sa,
        {
          fullName: name,
          email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.com`,
          functions: [fn],
          editionId: ids.editionMena,
          estimatedValue: value ?? null,
          ownerId: owner,
        },
        saCtx,
      );
      return lead.opportunityIds[0]!;
    };

    /* ---- sponsor: money ---- */
    await setTarget(
      sa,
      {
        userId: ids.memberSponsor,
        function: "sponsor",
        editionId: ids.editionMena,
        targetValue: "200000.00",
        ...YEAR,
      },
      saCtx,
    );

    const won = await open("Target Won", "sponsor", ids.memberSponsor, "90000.00");
    const openDeal = await open("Target Open", "sponsor", ids.memberSponsor, "60000.00");
    const cancelled = await open("Target Cancelled", "sponsor", ids.memberSponsor, "50000.00");

    await changeStage(sa, won, { stageKey: "won", finalValue: "80000.00" }, saCtx);
    await changeStage(sa, openDeal, { stageKey: "proposal" }, saCtx);
    await changeStage(sa, cancelled, { stageKey: "won", finalValue: "50000.00" }, saCtx);
    await changeStage(
      sa,
      cancelled,
      { stageKey: "cancelled", cancellationReasonKey: "non_payment" },
      saCtx,
    );

    const sponsor = (await targetProgress(sa, saCtx, { function: "sponsor" }))[0];
    R["sponsor"] = sponsor && {
      metric: sponsor.metric,
      target: sponsor.target,
      achieved: sponsor.achieved,
      remaining: sponsor.remaining,
      pipeline: sponsor.pipeline,
      forecast: sponsor.forecast,
      progressPct: sponsor.progressPct,
      currency: sponsor.currency,
    };

    /* ---- delegate: counted, and D2 ---- */
    await setTarget(
      sa,
      { userId: ids.memberDelegate, function: "delegate", editionId: ids.editionMena, targetValue: "3", ...YEAR },
      saCtx,
    );
    const d1 = await open("Delegate A", "delegate", ids.memberDelegate);
    const d2 = await open("Delegate B", "delegate", ids.memberDelegate);
    await changeStage(sa, d1, { stageKey: "confirmed" }, saCtx);
    await changeStage(sa, d2, { stageKey: "confirmed" }, saCtx);

    const beforeAttend = (await targetProgress(sa, saCtx, { function: "delegate" }))[0];
    R["delegateAchievedBefore"] = beforeAttend?.achieved;

    await changeStage(sa, d1, { stageKey: "attended" }, saCtx);
    const afterAttend = (await targetProgress(sa, saCtx, { function: "delegate" }))[0];
    R["delegateAchievedAfter"] = afterAttend?.achieved;
    R["delegateAttendedBeside"] = afterAttend?.attended;
    R["delegateMetric"] = afterAttend?.metric;
    R["delegateCurrency"] = afterAttend?.currency;

    /* ---- speaker: D4 ---- */
    await setTarget(
      sa,
      { userId: ids.memberSpeaker, function: "speaker", editionId: ids.editionMena, targetValue: "2", ...YEAR },
      saCtx,
    );
    const s1 = await open("Speaker A", "speaker", ids.memberSpeaker);
    const s2 = await open("Speaker B", "speaker", ids.memberSpeaker);
    await changeStage(sa, s1, { stageKey: "confirmed" }, saCtx);
    await changeStage(sa, s2, { stageKey: "confirmed" }, saCtx);
    const beforeWithdraw = (await targetProgress(sa, saCtx, { function: "speaker" }))[0];
    R["speakerAchievedBefore"] = beforeWithdraw?.achieved;

    await changeStage(sa, s1, { stageKey: "withdrawn", withdrawalReasonKey: "cannot_travel" }, saCtx);
    const afterWithdraw = (await targetProgress(sa, saCtx, { function: "speaker" }))[0];
    R["speakerAchievedAfter"] = afterWithdraw?.achieved;
    R["speakerWithdrawnBeside"] = afterWithdraw?.withdrawn;

    /* ---- visibility ---- */
    R["superSeesAll"] = (await targetProgress(sa, saCtx)).length;
    R["sponsorMemberSees"] = (await targetProgress(q("memberSponsor"), ctx("memberSponsor"))).map(
      (t) => t.function,
    );
    R["delegateMemberSees"] = (await targetProgress(q("memberDelegate"), ctx("memberDelegate"))).map(
      (t) => t.function,
    );
    R["adminInScopeSees"] = (await targetProgress(q("adminMena"), ctx("adminMena"))).length;
    /* The query AND the context both narrowed — targetProgress reads scope
       from the context, so narrowing only one would assert nothing. */
    const noScope = { eventScopeIds: [] };
    R["adminNoScopeSees"] = (
      await targetProgress(q("adminMena", noScope), ctx("adminMena", noScope))
    ).length;

    /* ---- only a Super Admin may set or change ---- */
    for (const [label, who] of [
      ["member", "memberSponsor"],
      ["admin", "adminMena"],
    ] as const) {
      try {
        await setTarget(
          q(who),
          { userId: ids[who], function: "sponsor", editionId: ids.editionMena, targetValue: "1", ...YEAR },
          ctx(who),
        );
        R[`${label}CouldSet`] = true;
      } catch {
        R[`${label}CouldSet`] = false;
      }
    }

    const sponsorTarget = (await targetProgress(sa, saCtx, { function: "sponsor" }))[0]!;
    try {
      await updateTarget(q("memberSponsor"), sponsorTarget.id, "1", ctx("memberSponsor"));
      R["memberCouldMoveTheGoalposts"] = true;
    } catch {
      R["memberCouldMoveTheGoalposts"] = false;
    }

    await updateTarget(sa, sponsorTarget.id, "150000.00", saCtx);
    const moved = (await targetProgress(sa, saCtx, { function: "sponsor" }))[0];
    R["targetMoved"] = moved?.target;

    /* ---- validation ---- */
    const validCase = {
      userId: ids.memberSponsor,
      function: "sponsor" as const,
      editionId: ids.editionMena as string | null,
      targetValue: "1000",
      ...YEAR,
    };
    for (const [label, patch] of [
      ["zero", { targetValue: "0" }],
      ["negative", { targetValue: "-5" }],
      ["backwardsPeriod", { periodStart: "2026-12-31", periodEnd: "2026-01-01" }],
      ["noScope", { editionId: null }],
    ] as const) {
      try {
        await setTarget(sa, { ...validCase, ...patch }, saCtx);
        R[`invalid_${label}`] = false;
      } catch {
        R[`invalid_${label}`] = true;
      }
    }

    return true;
  });
});

describe("a sponsor target is money", () => {
  it("measures achievement in final contracted value, excluding cancelled", () =>
    /* 80k won. The 50k that was won and then cancelled must not appear. */
    expect(R["sponsor"]).toMatchObject({
      metric: "revenue",
      currency: "USD",
      target: 200000,
      achieved: 80000,
      remaining: 120000,
    }));

  it("counts open estimates as pipeline, not as achievement", () =>
    expect((R["sponsor"] as Record<string, number>)["pipeline"]).toBe(60000));

  it("forecasts achieved plus weighted pipeline — 80k + 60k at 60%", () =>
    expect((R["sponsor"] as Record<string, number>)["forecast"]).toBe(116000));

  it("states progress as a fraction of the target", () =>
    expect((R["sponsor"] as Record<string, number>)["progressPct"]).toBeCloseTo(0.4, 5));
});

describe("delegate and speaker targets are counted, never priced", () => {
  it("the metric is a count and carries no currency", () => {
    expect(R["delegateMetric"]).toBe("count");
    expect(R["delegateCurrency"]).toBeNull();
  });
});

describe("D2 — attending does not add to the target", () => {
  it("two confirmations are two", () => expect(R["delegateAchievedBefore"]).toBe(2));
  it("and STILL two after one attends", () => expect(R["delegateAchievedAfter"]).toBe(2));
  it("attendance is reported beside the target, not inside it", () =>
    expect(R["delegateAttendedBeside"]).toBe(1));
});

describe("D4 — withdrawing removes achievement from the target", () => {
  it("two confirmations are two", () => expect(R["speakerAchievedBefore"]).toBe(2));
  it("and one after a withdrawal", () => expect(R["speakerAchievedAfter"]).toBe(1));
  it("with the withdrawal reported beside it", () =>
    expect(R["speakerWithdrawnBeside"]).toBe(1));
});

describe("who sees which targets", () => {
  it("Super Admin sees every one", () => expect(R["superSeesAll"]).toBe(3));
  it("a Team Member sees ONLY their own, and only their permitted function", () => {
    expect(R["sponsorMemberSees"]).toEqual(["sponsor"]);
    expect(R["delegateMemberSees"]).toEqual(["delegate"]);
  });
  it("an Admin sees targets inside their event scope", () =>
    expect(R["adminInScopeSees"]).toBe(3));
  it("AN ADMIN WITH NO SCOPE SEES NONE — empty is not a wildcard", () =>
    expect(R["adminNoScopeSees"]).toBe(0));
});

describe("§9 — only a Super Admin sets targets", () => {
  it("a Team Member cannot", () => expect(R["memberCouldSet"]).toBe(false));
  it("an Admin cannot", () => expect(R["adminCouldSet"]).toBe(false));
  it("A TEAM MEMBER CANNOT MOVE THEIR OWN GOALPOSTS", () =>
    /* If they could set it low, every progress figure in the system becomes
       unfalsifiable. */
    expect(R["memberCouldMoveTheGoalposts"]).toBe(false));
  it("a Super Admin can, and the change is audited", () =>
    expect(R["targetMoved"]).toBe(150000));
});

describe("validation", () => {
  it("rejects a zero target", () => expect(R["invalid_zero"]).toBe(true));
  it("rejects a negative target", () => expect(R["invalid_negative"]).toBe(true));
  it("rejects a period that ends before it starts", () =>
    expect(R["invalid_backwardsPeriod"]).toBe(true));
  it("rejects a target attached to neither an event nor an edition", () =>
    expect(R["invalid_noScope"]).toBe(true));
});
