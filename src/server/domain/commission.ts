/**
 * COMMISSION — §10. SPONSOR ONLY IN V1.
 *
 * Four rules govern everything in this file:
 *
 *   1. NO RATE IS HARDCODED. Every percentage, fixed amount and tier comes
 *      from `commission_rules`. There is not a number in this module that
 *      determines what anyone earns.
 *   2. THE BASE IS FINAL CONTRACTED VALUE AT WON. Never the estimate, never
 *      cash collected. A commission on an estimate is a commission on a guess.
 *   3. THE RATE IS LOCKED AT WON. The rule that applied is COPIED onto the
 *      entry — basis, rate, tier table, split. Editing a rule afterwards
 *      cannot reach backwards into money already earned, because nothing
 *      re-reads the rule to recompute.
 *   4. THE LEDGER IS APPEND-ONLY. A balance is `SUM(amount)`. A reversal is a
 *      negative row pointing at what it reverses. Nothing is ever updated or
 *      deleted, so the history of what someone was told they earned survives
 *      even when it changes.
 *
 * Commission is REPORTING. Not payroll, not accounting.
 */

import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";

import {
  commissionEntries,
  commissionRuleTiers,
  commissionRules,
  editions,
  opportunities,
  users,
} from "../db/schema";
import type { ScopedQuery, Tx } from "../auth/scoped";
import type { AuthContext } from "../auth/permissions";
import { canManageCommissionRules, canViewCommissionFor } from "../auth/permissions";
import { forbidden } from "../auth/context";
import { recordAudit } from "./audit";
import { ValidationError } from "./opportunities";

type Maybe<T> = T | null | undefined;

/**
 * A timestamp safe to drop into a RAW `sql` template.
 *
 * Drizzle's typed helpers (`eq`, `lte`, …) infer the type from the column and
 * serialise a Date correctly. A raw template has no column to infer from, and
 * postgres.js throws `ERR_INVALID_ARG_TYPE` on the Date object. This has now
 * caught the build twice; naming it makes the requirement visible at the call
 * site instead of at runtime.
 */
export const tsAt = (d: Date) => sql`${d.toISOString()}::timestamptz`;

export type Tier = {
  minValue: string;
  maxValue: string | null;
  ratePct: string | null;
  fixedAmount: string | null;
};

export type ResolvedRule = {
  id: string;
  name: string;
  basis: "percentage" | "fixed_per_deal" | "tiered";
  ratePct: string | null;
  fixedAmount: string | null;
  currency: string;
  tiers: Tier[];
};

/**
 * Which rule applies to this deal, at this moment.
 *
 * Specificity wins: a rule naming this person beats one naming this edition,
 * which beats one naming this event, which beats the house rule. Ties break on
 * the most recently effective — the newer decision is the current one.
 *
 * `effective_from <= at` and `effective_to` open or later: rules are versioned
 * in time rather than edited, so asking "which rule applied on the day this
 * was won" has an answer even years later.
 */
export async function resolveRule(
  q: ScopedQuery | { directory: Tx },
  input: { function: "sponsor"; userId: string; eventId: string; editionId: string; at: Date },
): Promise<ResolvedRule | null> {
  const rows = await q.directory
    .select({
      id: commissionRules.id,
      name: commissionRules.name,
      basis: commissionRules.basis,
      ratePct: commissionRules.ratePct,
      fixedAmount: commissionRules.fixedAmount,
      currency: commissionRules.currency,
      specificity: sql<number>`
        case
          when ${commissionRules.scopeUserId} = ${input.userId} then 3
          when ${commissionRules.scopeEditionId} = ${input.editionId} then 2
          when ${commissionRules.scopeEventId} = ${input.eventId} then 1
          else 0
        end`,
    })
    .from(commissionRules)
    .where(
      and(
        eq(commissionRules.function, "sponsor"),
        eq(commissionRules.isActive, true),
        lte(commissionRules.effectiveFrom, input.at),
        /* ISO string with an explicit cast, not a Date. A raw sql template has
           no column to infer a type from, so a JS Date reaches the driver as
           an object it cannot serialise. The `lte` above is fine precisely
           because the column tells the driver what it is. Same trap as the
           follow-up bucketing in activities.ts — see `tsAt` below. */
        or(
          isNull(commissionRules.effectiveTo),
          sql`${commissionRules.effectiveTo} > ${tsAt(input.at)}`,
        ),
        /* A scoped rule must match; an unscoped one is the house rule. */
        or(isNull(commissionRules.scopeUserId), eq(commissionRules.scopeUserId, input.userId)),
        or(
          isNull(commissionRules.scopeEditionId),
          eq(commissionRules.scopeEditionId, input.editionId),
        ),
        or(isNull(commissionRules.scopeEventId), eq(commissionRules.scopeEventId, input.eventId)),
      ),
    )
    .orderBy(desc(sql`3`), desc(commissionRules.effectiveFrom))
    .limit(1);

  const rule = rows[0];
  if (!rule) return null;

  const tiers =
    rule.basis === "tiered"
      ? await q.directory
          .select({
            minValue: commissionRuleTiers.minValue,
            maxValue: commissionRuleTiers.maxValue,
            ratePct: commissionRuleTiers.ratePct,
            fixedAmount: commissionRuleTiers.fixedAmount,
          })
          .from(commissionRuleTiers)
          .where(eq(commissionRuleTiers.ruleId, rule.id))
          .orderBy(asc(commissionRuleTiers.minValue))
      : [];

  return { ...rule, tiers: tiers as Tier[] };
}

/**
 * What a rule pays on a value. PURE — no database, no context.
 *
 * Kept pure so the simulator, the WON path and the tests all compute through
 * the same function. Three implementations of "what does this pay" is how a
 * simulator ends up promising a number the ledger then contradicts.
 *
 * Tiers are MARGINAL: a 200k deal on 0–100k at 5% and 100k+ at 10% pays
 * 5k + 10k, not 20k. A cliff would mean earning less on a larger deal at the
 * boundary, which no commission scheme intends.
 */
export function computeAmount(rule: ResolvedRule, baseValue: number): number {
  if (!Number.isFinite(baseValue) || baseValue <= 0) return 0;

  if (rule.basis === "fixed_per_deal") {
    return Number(rule.fixedAmount ?? 0);
  }

  if (rule.basis === "percentage") {
    return (baseValue * Number(rule.ratePct ?? 0)) / 100;
  }

  let total = 0;
  for (const tier of rule.tiers) {
    const from = Number(tier.minValue);
    const to = tier.maxValue == null ? Infinity : Number(tier.maxValue);
    if (baseValue <= from) continue;
    const slice = Math.min(baseValue, to) - from;
    if (slice <= 0) continue;
    total +=
      tier.ratePct != null ? (slice * Number(tier.ratePct)) / 100 : Number(tier.fixedAmount ?? 0);
  }
  return total;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------ the WON path */

/**
 * Write the earned entries for a sponsor deal that has just been won.
 *
 * Takes the transaction, so the entries and the stage change commit together:
 * a WON deal with no commission row, or a commission row on a deal that was
 * never won, are both states nobody could explain afterwards.
 *
 * Idempotent. A second call for the same opportunity writes nothing — the
 * stage machine can be re-entered and the ledger must not double.
 */
export async function recordEarnedCommission(
  tx: Tx,
  input: {
    opportunityId: string;
    function: string;
    ownerId: string | null;
    secondaryOwnerId: string | null;
    ownerSplitPct: number;
    secondarySplitPct: number;
    finalValue: string | null;
    currency: string;
    editionId: string;
    wonAt: Date;
  },
  ctx: AuthContext,
): Promise<{ entries: number }> {
  /* §10 — sponsor only in V1. Delegate and speaker earn nothing, and the
     guard is here rather than at the call site so no future caller can
     accidentally create one. */
  if (input.function !== "sponsor") return { entries: 0 };
  if (!input.ownerId || !input.finalValue) return { entries: 0 };

  const existing = await tx
    .select({ id: commissionEntries.id })
    .from(commissionEntries)
    .where(
      and(
        eq(commissionEntries.opportunityId, input.opportunityId),
        eq(commissionEntries.entryType, "earned"),
      ),
    )
    .limit(1);
  if (existing.length) return { entries: 0 };

  const edition = await tx
    .select({ eventId: editions.eventId })
    .from(editions)
    .where(eq(editions.id, input.editionId))
    .limit(1);
  const eventId = edition[0]?.eventId;
  if (!eventId) return { entries: 0 };

  const base = Number(input.finalValue);
  const shares: { userId: string; splitPct: number }[] = [
    { userId: input.ownerId, splitPct: input.ownerSplitPct },
  ];
  if (input.secondaryOwnerId && input.secondarySplitPct > 0) {
    shares.push({ userId: input.secondaryOwnerId, splitPct: input.secondarySplitPct });
  }

  let written = 0;
  for (const share of shares) {
    /* Resolved PER PERSON: a rule may name one of them specifically, and a
       split does not mean they earn at the same rate. */
    const rule = await resolveRule(
      { directory: tx },
      {
        function: "sponsor",
        userId: share.userId,
        eventId,
        editionId: input.editionId,
        at: input.wonAt,
      },
    );
    if (!rule) continue;

    const full = computeAmount(rule, base);
    const amount = round2((full * share.splitPct) / 100);
    if (amount === 0) continue;

    await tx.insert(commissionEntries).values({
      opportunityId: input.opportunityId,
      userId: share.userId,
      ruleId: rule.id,
      entryType: "earned",
      /* THE LOCK. Everything needed to explain this number, copied. Nothing
         re-reads the rule to recompute, so editing it later cannot reach
         backwards into money already earned. */
      lockedBasis: rule.basis,
      lockedRatePct: rule.ratePct,
      lockedFixedAmount: rule.fixedAmount,
      lockedTiers: rule.tiers.length ? rule.tiers : null,
      baseValue: input.finalValue,
      splitPct: share.splitPct,
      amount: String(amount),
      currency: input.currency,
      effectiveAt: input.wonAt,
      createdBy: ctx.userId,
    });
    written += 1;

    await recordAudit(tx, {
      ctx,
      entityType: "commission_entry",
      entityId: input.opportunityId,
      action: "commission_created",
      after: { userId: share.userId, amount, ruleId: rule.id, splitPct: share.splitPct },
    });
  }

  return { entries: written };
}

/**
 * §4 — CANCELLED automatically reverses. No manual reversal is permitted, and
 * this function is the only writer of a `reversal` entry.
 *
 * Each reversal is a NEGATIVE row pointing at the entry it undoes via
 * `reverses_entry_id`, so the balance is still `SUM(amount)` and the original
 * number survives. Deleting or editing the earned row would erase the fact
 * that someone was once told they had earned it.
 *
 * Idempotent: an entry already reversed is skipped.
 */
export async function reverseCommissionFor(
  tx: Tx,
  opportunityId: string,
  reason: string,
  ctx: AuthContext,
): Promise<{ reversed: number }> {
  const earned = await tx
    .select({
      id: commissionEntries.id,
      userId: commissionEntries.userId,
      ruleId: commissionEntries.ruleId,
      lockedBasis: commissionEntries.lockedBasis,
      lockedRatePct: commissionEntries.lockedRatePct,
      lockedFixedAmount: commissionEntries.lockedFixedAmount,
      lockedTiers: commissionEntries.lockedTiers,
      baseValue: commissionEntries.baseValue,
      splitPct: commissionEntries.splitPct,
      amount: commissionEntries.amount,
      currency: commissionEntries.currency,
    })
    .from(commissionEntries)
    .where(
      and(
        eq(commissionEntries.opportunityId, opportunityId),
        sql`${commissionEntries.entryType} <> 'reversal'`,
      ),
    );

  if (!earned.length) return { reversed: 0 };

  const alreadyReversed = await tx
    .select({ reverses: commissionEntries.reversesEntryId })
    .from(commissionEntries)
    .where(
      and(
        eq(commissionEntries.opportunityId, opportunityId),
        eq(commissionEntries.entryType, "reversal"),
      ),
    );
  const done = new Set(alreadyReversed.map((r) => r.reverses));

  let reversed = 0;
  for (const entry of earned) {
    if (done.has(entry.id)) continue;

    await tx.insert(commissionEntries).values({
      opportunityId,
      userId: entry.userId,
      ruleId: entry.ruleId,
      entryType: "reversal",
      reversesEntryId: entry.id,
      /* The reversal carries the SAME locked terms as what it undoes. A
         reversal computed from today's rule could differ from what was paid. */
      lockedBasis: entry.lockedBasis,
      lockedRatePct: entry.lockedRatePct,
      lockedFixedAmount: entry.lockedFixedAmount,
      lockedTiers: entry.lockedTiers,
      baseValue: entry.baseValue,
      splitPct: entry.splitPct,
      amount: String(-Number(entry.amount)),
      currency: entry.currency,
      note: reason,
      createdBy: ctx.userId,
    });
    reversed += 1;

    await recordAudit(tx, {
      ctx,
      entityType: "commission_entry",
      entityId: opportunityId,
      action: "commission_reversed",
      before: { entryId: entry.id, amount: entry.amount },
      after: { amount: String(-Number(entry.amount)), reason },
    });
  }

  return { reversed };
}

/* ------------------------------------------------------------------ reading */

export type LedgerRow = {
  id: string;
  opportunityId: string;
  userId: string;
  userName: string;
  entryType: "earned" | "adjustment" | "reversal";
  amount: number;
  currency: string;
  baseValue: number;
  splitPct: number;
  effectiveAt: Date;
  note: string | null;
  reversesEntryId: string | null;
  personName: string | null;
  editionName: string | null;
};

/** The ledger, scoped. `q.where.commissionEntries()` already encodes §10's
    visibility: own only, unless Super Admin or a granted Admin. */
export async function ledger(q: ScopedQuery, filters: { userId?: Maybe<string> } = {}) {
  const extra = filters.userId ? eq(commissionEntries.userId, filters.userId) : undefined;

  const rows = await q.directory
    .select({
      id: commissionEntries.id,
      opportunityId: commissionEntries.opportunityId,
      userId: commissionEntries.userId,
      userName: users.fullName,
      entryType: commissionEntries.entryType,
      amount: commissionEntries.amount,
      currency: commissionEntries.currency,
      baseValue: commissionEntries.baseValue,
      splitPct: commissionEntries.splitPct,
      effectiveAt: commissionEntries.effectiveAt,
      note: commissionEntries.note,
      reversesEntryId: commissionEntries.reversesEntryId,
      editionName: editions.name,
    })
    .from(commissionEntries)
    .innerJoin(users, eq(users.id, commissionEntries.userId))
    .leftJoin(opportunities, eq(opportunities.id, commissionEntries.opportunityId))
    .leftJoin(editions, eq(editions.id, opportunities.editionId))
    .where(q.where.commissionEntries(extra))
    .orderBy(desc(commissionEntries.effectiveAt));

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    baseValue: Number(r.baseValue),
  }));
}

export type CommissionSummary = {
  earned: number;
  reversed: number;
  /** The balance. SUM(amount) — earned plus the negative reversals. */
  balance: number;
  /** §10 dashboard: what is still in play, at the locked terms that would
      apply if each open deal closed at its estimate today. */
  inPipeline: number;
  currency: string;
};

export async function commissionSummary(
  q: ScopedQuery,
  ctx: AuthContext,
  userId: string,
): Promise<CommissionSummary> {
  if (!canViewCommissionFor(ctx, userId)) throw forbidden("Commission is not visible to you.");

  const rows = await q.directory
    .select({
      earned: sql<string>`coalesce(sum(${commissionEntries.amount}) filter (where ${commissionEntries.entryType} <> 'reversal'), 0)`,
      reversed: sql<string>`coalesce(sum(${commissionEntries.amount}) filter (where ${commissionEntries.entryType} = 'reversal'), 0)`,
      balance: sql<string>`coalesce(sum(${commissionEntries.amount}), 0)`,
    })
    .from(commissionEntries)
    .where(q.where.commissionEntries(eq(commissionEntries.userId, userId)));

  const r = rows[0]!;
  return {
    earned: Number(r.earned),
    reversed: Number(r.reversed),
    balance: Number(r.balance),
    inPipeline: await pipelineCommission(q, userId),
    currency: "USD",
  };
}

/**
 * What the open pipeline would pay, at the rules in force today.
 *
 * Explicitly NOT locked — nothing has been won, so there is nothing to lock.
 * It moves when a rule changes, and that is correct: it is a projection, and
 * the screen labels it as one.
 */
async function pipelineCommission(q: ScopedQuery, userId: string): Promise<number> {
  const open = await q.directory
    .select({
      estimatedValue: opportunities.estimatedValue,
      editionId: opportunities.editionId,
      eventId: editions.eventId,
      splitPct: sql<number>`case when ${opportunities.ownerId} = ${userId}
        then ${opportunities.ownerSplitPct} else ${opportunities.secondarySplitPct} end`,
    })
    .from(opportunities)
    .innerJoin(editions, eq(editions.id, opportunities.editionId))
    .where(
      q.where.opportunities(
        and(
          eq(opportunities.function, "sponsor"),
          isNull(opportunities.archivedAt),
          or(eq(opportunities.ownerId, userId), eq(opportunities.secondaryOwnerId, userId)),
          sql`exists (select 1 from pipeline_stages ps
                      where ps.function = ${opportunities.function}
                        and ps.key = ${opportunities.stageKey} and ps.is_open)`,
        ),
      ),
    );

  const now = new Date();
  let total = 0;
  for (const row of open) {
    if (!row.estimatedValue) continue;
    const rule = await resolveRule(q, {
      function: "sponsor",
      userId,
      eventId: row.eventId,
      editionId: row.editionId,
      at: now,
    });
    if (!rule) continue;
    total += (computeAmount(rule, Number(row.estimatedValue)) * row.splitPct) / 100;
  }
  return round2(total);
}

/**
 * §10 — the simulator, built on the ACTUAL configured rules.
 *
 * A simulator with its own arithmetic is a second opinion that will eventually
 * disagree with the ledger. This one resolves the same rule and calls the same
 * pure function the WON path does.
 */
export async function simulate(
  q: ScopedQuery,
  ctx: AuthContext,
  input: { userId: string; editionId: string; values: number[] },
) {
  if (!canViewCommissionFor(ctx, input.userId))
    throw forbidden("Commission is not visible to you.");

  const edition = await q.directory
    .select({ eventId: editions.eventId, name: editions.name })
    .from(editions)
    .where(eq(editions.id, input.editionId))
    .limit(1);
  if (!edition[0]) throw new ValidationError("That edition does not exist.");

  const rule = await resolveRule(q, {
    function: "sponsor",
    userId: input.userId,
    eventId: edition[0].eventId,
    editionId: input.editionId,
    at: new Date(),
  });

  return {
    rule: rule ? { id: rule.id, name: rule.name, basis: rule.basis } : null,
    /* No rule is a real answer, not zero. Zero implies a rule that pays
       nothing; null says nobody has configured one. */
    results: rule
      ? input.values.map((value) => ({ value, commission: round2(computeAmount(rule, value)) }))
      : input.values.map((value) => ({ value, commission: null })),
  };
}

/* -------------------------------------------------------------------- rules */

export async function listRules(q: ScopedQuery, ctx: AuthContext) {
  if (!canManageCommissionRules(ctx) && ctx.role !== "super_admin") {
    throw forbidden("Commission rules are not visible to you.");
  }
  const rules = await q.directory
    .select({
      id: commissionRules.id,
      name: commissionRules.name,
      basis: commissionRules.basis,
      ratePct: commissionRules.ratePct,
      fixedAmount: commissionRules.fixedAmount,
      currency: commissionRules.currency,
      scopeUserId: commissionRules.scopeUserId,
      scopeEventId: commissionRules.scopeEventId,
      scopeEditionId: commissionRules.scopeEditionId,
      effectiveFrom: commissionRules.effectiveFrom,
      effectiveTo: commissionRules.effectiveTo,
      isActive: commissionRules.isActive,
    })
    .from(commissionRules)
    .orderBy(desc(commissionRules.effectiveFrom));
  return rules;
}

export type CreateRuleInput = {
  name: string;
  basis: "percentage" | "fixed_per_deal" | "tiered";
  ratePct?: Maybe<string>;
  fixedAmount?: Maybe<string>;
  currency?: Maybe<string>;
  scopeUserId?: Maybe<string>;
  scopeEventId?: Maybe<string>;
  scopeEditionId?: Maybe<string>;
  effectiveFrom: string;
  tiers?: Tier[];
};

export async function createRule(
  q: ScopedQuery,
  input: CreateRuleInput,
  ctx: AuthContext,
): Promise<{ id: string }> {
  if (!canManageCommissionRules(ctx)) throw forbidden("You cannot manage commission rules.");

  if (input.basis === "percentage" && !input.ratePct) {
    throw new ValidationError("A percentage rule needs a rate.");
  }
  if (input.basis === "fixed_per_deal" && !input.fixedAmount) {
    throw new ValidationError("A fixed rule needs an amount.");
  }
  if (input.basis === "tiered" && !input.tiers?.length) {
    throw new ValidationError("A tiered rule needs at least one tier.");
  }

  return q.directory.transaction(async (tx) => {
    const [row] = await tx
      .insert(commissionRules)
      .values({
        name: input.name,
        /* §10 — V1 creates sponsor rules only. The column stays for future
           extension; the write path does not. */
        function: "sponsor",
        basis: input.basis,
        ratePct: input.ratePct ?? null,
        fixedAmount: input.fixedAmount ?? null,
        currency: input.currency ?? "USD",
        scopeUserId: input.scopeUserId ?? null,
        scopeEventId: input.scopeEventId ?? null,
        scopeEditionId: input.scopeEditionId ?? null,
        effectiveFrom: new Date(input.effectiveFrom),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning({ id: commissionRules.id });

    const id = row!.id;
    if (input.tiers?.length) {
      await tx.insert(commissionRuleTiers).values(
        input.tiers.map((t, i) => ({
          ruleId: id,
          minValue: t.minValue,
          maxValue: t.maxValue,
          ratePct: t.ratePct,
          fixedAmount: t.fixedAmount,
          sortOrder: i,
          createdBy: ctx.userId,
        })),
      );
    }

    await recordAudit(tx, {
      ctx,
      entityType: "commission_rule",
      entityId: id,
      action: "created",
      after: { name: input.name, basis: input.basis, ratePct: input.ratePct ?? null },
    });
    return { id };
  });
}

/**
 * Rules are VERSIONED, not edited. Superseding closes the old one at the
 * moment the new one starts, so "which rule applied when this was won" always
 * has one answer — and every entry already written keeps its locked terms
 * regardless.
 */
export async function supersedeRule(
  q: ScopedQuery,
  ruleId: string,
  next: CreateRuleInput,
  ctx: AuthContext,
): Promise<{ id: string }> {
  if (!canManageCommissionRules(ctx)) throw forbidden("You cannot manage commission rules.");
  const from = new Date(next.effectiveFrom);

  await q.directory
    .update(commissionRules)
    .set({ effectiveTo: from, updatedAt: new Date(), updatedBy: ctx.userId })
    .where(eq(commissionRules.id, ruleId));

  return createRule(q, next, ctx);
}
