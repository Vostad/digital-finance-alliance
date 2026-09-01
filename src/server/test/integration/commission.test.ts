/**
 * COMMISSION — §10, §4, and §39 scenarios 14, 15, 16, plus reversal
 * idempotency.
 *
 * The four properties, each of which fails silently if it is wrong:
 *   the base is FINAL value, the rate is LOCKED at WON, CANCELLED reverses
 *   AUTOMATICALLY, and the balance is SUM(amount) over an append-only ledger.
 */

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { commissionEntries } from "@/server/db/schema";
import {
  commissionSummary,
  computeAmount,
  createRule,
  ledger,
  simulate,
  supersedeRule,
} from "@/server/domain/commission";
import { createLead } from "@/server/domain/leads";
import { changeStage } from "@/server/domain/opportunities";
import { setSplit } from "@/server/domain/assignment";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};
const EARLY = "2026-01-01T00:00:00.000Z";
const LATER = "2026-06-01T00:00:00.000Z";

beforeAll(async () => {
  await withFixture(async ({ tx, ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin", { canManageCommissionRules: true, canViewCommission: true });

    const open = async (name: string, value: string, fn: "sponsor" | "speaker" = "sponsor") => {
      const lead = await createLead(
        sa,
        {
          fullName: name,
          email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.com`,
          functions: [fn],
          editionId: ids.editionMena,
          estimatedValue: value,
          ownerId: ids.memberSponsor,
        },
        saCtx,
      );
      return lead.opportunityIds[0]!;
    };

    /* ---- 10% house rule ---- */
    await createRule(
      sa,
      { name: "House 10%", basis: "percentage", ratePct: "10.000", effectiveFrom: EARLY },
      saCtx,
    );

    /* §39/14 — a WON deal creates commission from the FINAL value, not the
       estimate. Estimated 100k, contracted 80k → 8,000, never 10,000. */
    const a = await open("Deal A", "100000.00");
    await changeStage(sa, a, { stageKey: "won", finalValue: "80000.00" }, saCtx);

    const entriesA = await tx
      .select({
        amount: commissionEntries.amount,
        baseValue: commissionEntries.baseValue,
        lockedRatePct: commissionEntries.lockedRatePct,
        entryType: commissionEntries.entryType,
      })
      .from(commissionEntries)
      .where(eq(commissionEntries.opportunityId, a));
    R["dealA"] = entriesA.map((e) => ({
      amount: Number(e.amount),
      base: Number(e.baseValue),
      rate: e.lockedRatePct,
      type: e.entryType,
    }));

    /* ---- §39/15 — changing the rule must not move history ---- */
    await supersedeRule(
      sa,
      (await tx.select({ id: commissionEntries.ruleId }).from(commissionEntries).limit(1))[0]!
        .id as string,
      { name: "House 20%", basis: "percentage", ratePct: "20.000", effectiveFrom: LATER },
      saCtx,
    );

    const afterRuleChange = await tx
      .select({ amount: commissionEntries.amount, lockedRatePct: commissionEntries.lockedRatePct })
      .from(commissionEntries)
      .where(eq(commissionEntries.opportunityId, a));
    R["dealAAfterRuleChange"] = afterRuleChange.map((e) => ({
      amount: Number(e.amount),
      rate: e.lockedRatePct,
    }));

    /* A NEW deal won today earns at the new rate. */
    const b = await open("Deal B", "50000.00");
    await changeStage(sa, b, { stageKey: "won", finalValue: "50000.00" }, saCtx);
    const entriesB = await tx
      .select({ amount: commissionEntries.amount, lockedRatePct: commissionEntries.lockedRatePct })
      .from(commissionEntries)
      .where(eq(commissionEntries.opportunityId, b));
    R["dealB"] = entriesB.map((e) => ({ amount: Number(e.amount), rate: e.lockedRatePct }));

    /* ---- §39/16 — CANCELLED reverses automatically ---- */
    const summaryBefore = await commissionSummary(sa, saCtx, ids.memberSponsor);
    R["balanceBeforeCancel"] = summaryBefore.balance;

    await changeStage(
      sa,
      b,
      { stageKey: "cancelled", cancellationReasonKey: "non_payment" },
      saCtx,
    );

    const entriesBAfter = await tx
      .select({
        amount: commissionEntries.amount,
        entryType: commissionEntries.entryType,
        reverses: commissionEntries.reversesEntryId,
        lockedRatePct: commissionEntries.lockedRatePct,
      })
      .from(commissionEntries)
      .where(eq(commissionEntries.opportunityId, b));
    R["dealBAfterCancel"] = entriesBAfter.map((e) => ({
      amount: Number(e.amount),
      type: e.entryType,
      linked: Boolean(e.reverses),
      rate: e.lockedRatePct,
    }));

    const summaryAfter = await commissionSummary(sa, saCtx, ids.memberSponsor);
    R["balanceAfterCancel"] = summaryAfter.balance;
    R["earnedTotal"] = summaryAfter.earned;
    R["reversedTotal"] = summaryAfter.reversed;

    /* Reversal is idempotent — cancelling is terminal, but re-entering the
       reversal path must not double-negate. */
    const { reverseCommissionFor } = await import("@/server/domain/commission");
    await tx.transaction(async (inner) => {
      await reverseCommissionFor(inner, b, "second attempt", saCtx);
    });
    const afterSecond = await tx
      .select({ id: commissionEntries.id })
      .from(commissionEntries)
      .where(eq(commissionEntries.opportunityId, b));
    R["entriesAfterSecondReversal"] = afterSecond.length;

    /* ---- splits ---- */
    const c = await open("Deal C", "100000.00");
    /* The secondary owner must hold the function too — Boundary 4's rule, and
       Sara holds speaker only. The Super Admin holds every function by role. */
    await setSplit(sa, c, { secondaryOwnerId: ids.superAdmin, ownerSplitPct: 70 }, saCtx);
    await changeStage(sa, c, { stageKey: "won", finalValue: "100000.00" }, saCtx);
    const entriesC = await tx
      .select({
        userId: commissionEntries.userId,
        amount: commissionEntries.amount,
        splitPct: commissionEntries.splitPct,
      })
      .from(commissionEntries)
      .where(eq(commissionEntries.opportunityId, c));
    R["split"] = entriesC
      .map((e) => ({ amount: Number(e.amount), pct: e.splitPct }))
      .sort((x, y) => y.amount - x.amount);

    /* ---- §10 — delegate and speaker earn NOTHING ---- */
    const s = await open("Speaker Deal", "0.00", "speaker");
    await changeStage(sa, s, { stageKey: "confirmed" }, saCtx);
    const speakerEntries = await tx
      .select({ id: commissionEntries.id })
      .from(commissionEntries)
      .where(eq(commissionEntries.opportunityId, s));
    R["speakerCommissionRows"] = speakerEntries.length;

    /* ---- visibility ---- */
    R["ownerSeesOwn"] = (await ledger(q("memberSponsor"), {})).length;
    try {
      await commissionSummary(q("memberSponsor"), ctx("memberSponsor"), ids.superAdmin);
      R["memberSawAnother"] = true;
    } catch {
      R["memberSawAnother"] = false;
    }
    const grantedAdmin = ctx("adminMena", { canViewCommission: true });
    R["adminWithGrantSees"] = (
      await ledger(q("adminMena", { canViewCommission: true }), {})
    ).length;
    R["adminWithoutGrantSees"] = (await ledger(q("adminMena"), {})).length;

    /* ---- the simulator uses the SAME rule and the SAME arithmetic ---- */
    const sim = await simulate(sa, saCtx, {
      userId: ids.memberSponsor,
      editionId: ids.editionMena,
      values: [50000, 100000],
    });
    R["simulator"] = sim.results.map((r) => r.commission);
    R["simulatorRule"] = sim.rule?.name;

    void grantedAdmin;
    return true;
  });
});

describe("the base is the FINAL contracted value, never the estimate", () => {
  it("100k estimated, 80k contracted, 10% → 8,000", () =>
    expect(R["dealA"]).toEqual([{ amount: 8000, base: 80000, rate: "10.000", type: "earned" }]));
});

describe("the rate is LOCKED at WON", () => {
  it("changing the rule afterwards does not move history", () =>
    /* If anything re-read the rule to recompute, this would now read 16,000. */
    expect(R["dealAAfterRuleChange"]).toEqual([{ amount: 8000, rate: "10.000" }]));

  it("but a NEW deal earns at the new rate", () =>
    expect(R["dealB"]).toEqual([{ amount: 10000, rate: "20.000" }]));
});

describe("CANCELLED reverses automatically", () => {
  it("writes a negative entry linked to what it reverses", () =>
    expect(R["dealBAfterCancel"]).toEqual([
      { amount: 10000, type: "earned", linked: false, rate: "20.000" },
      { amount: -10000, type: "reversal", linked: true, rate: "20.000" },
    ]));

  it("the reversal carries the SAME locked terms as what it undoes", () => {
    const rows = R["dealBAfterCancel"] as { rate: string }[];
    expect(rows[0]!.rate).toBe(rows[1]!.rate);
  });

  it("the balance is SUM(amount) and returns to the pre-deal figure", () => {
    expect(R["balanceBeforeCancel"]).toBe(18000);
    expect(R["balanceAfterCancel"]).toBe(8000);
  });

  it("earned and reversed are reported separately", () => {
    expect(R["earnedTotal"]).toBe(18000);
    expect(R["reversedTotal"]).toBe(-10000);
  });

  it("NOTHING IS DELETED — the earned entry survives its own reversal", () =>
    expect((R["dealBAfterCancel"] as unknown[]).length).toBe(2));

  it("reversing twice does not double-negate", () =>
    expect(R["entriesAfterSecondReversal"]).toBe(2));
});

describe("splits", () => {
  it("70/30 of 20% on 100k → 14,000 and 6,000", () =>
    expect(R["split"]).toEqual([
      { amount: 14000, pct: 70 },
      { amount: 6000, pct: 30 },
    ]));
});

describe("§10 — sponsor only in V1", () => {
  it("a confirmed speaker earns no commission at all", () =>
    expect(R["speakerCommissionRows"]).toBe(0));
});

describe("visibility", () => {
  it("an owner sees their own ledger", () => expect(R["ownerSeesOwn"]).toBeGreaterThan(0));
  it("a Team Member cannot read another person's", () => expect(R["memberSawAnother"]).toBe(false));
  it("an Admin WITHOUT the grant sees none of the team's", () =>
    expect(R["adminWithoutGrantSees"]).toBe(0));
  it("an Admin WITH the grant sees their scoped events'", () =>
    expect(R["adminWithGrantSees"]).toBeGreaterThan(0));
});

describe("the simulator uses the configured rules, not its own arithmetic", () => {
  it("resolves the rule in force", () => expect(R["simulatorRule"]).toBe("House 20%"));
  it("and computes through the same function the ledger does", () =>
    expect(R["simulator"]).toEqual([10000, 20000]));
});

describe("computeAmount is pure, so the simulator and the ledger cannot disagree", () => {
  const tiered = {
    id: "x",
    name: "Tiered",
    basis: "tiered" as const,
    ratePct: null,
    fixedAmount: null,
    currency: "USD",
    tiers: [
      { minValue: "0", maxValue: "100000", ratePct: "5.000", fixedAmount: null },
      { minValue: "100000", maxValue: null, ratePct: "10.000", fixedAmount: null },
    ],
  };

  it("tiers are MARGINAL, not a cliff", () => {
    /* 200k pays 5% of the first 100k plus 10% of the next 100k = 15,000.
       A cliff would pay 20,000 and would mean earning LESS just below the
       boundary than just above it. */
    expect(computeAmount(tiered, 200000)).toBe(15000);
    expect(computeAmount(tiered, 100000)).toBe(5000);
    expect(computeAmount(tiered, 50000)).toBe(2500);
  });

  it("a larger deal never pays less", () => {
    let previous = -1;
    for (const v of [0, 1000, 99999, 100000, 100001, 500000]) {
      const paid = computeAmount(tiered, v);
      expect(paid).toBeGreaterThanOrEqual(previous);
      previous = paid;
    }
  });

  it("pays nothing on a non-positive value", () => {
    expect(computeAmount(tiered, 0)).toBe(0);
    expect(computeAmount(tiered, -5)).toBe(0);
  });
});
