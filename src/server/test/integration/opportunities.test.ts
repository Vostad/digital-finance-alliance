/**
 * WORKSTREAMS AGAINST POSTGRES — §39 scenarios 1, 6, 7, 8, 12, 13, 17, 19,
 * and the §46.3 transition rules enforced end to end.
 *
 * The scenario this file exists for:
 *
 *   John Smith / ABC Bank    Sponsor  → Ahmed
 *                            Speaker  → Sara
 *                            Delegate → Imran
 *
 * Three workstreams, three owners, ONE person, ONE company.
 */

import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { activities, auditLog, opportunities, people } from "@/server/db/schema";
import { resolvePerson } from "@/server/domain/directory";
import {
  ValidationError,
  changeStage,
  cloneIntoEdition,
  createOpportunity,
  listOpportunities,
} from "@/server/domain/opportunities";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};

beforeAll(async () => {
  await withFixture(async ({ tx, ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin");

    /* ONE person, ONE company. */
    const person = await resolvePerson(
      sa,
      { fullName: "John Smith", email: "john.smith@abcbank.com", companyName: "ABC Bank" },
      saCtx,
    );

    /* THREE workstreams, THREE owners. */
    const sponsor = await createOpportunity(
      sa,
      {
        personId: person.id,
        companyId: person.companyId,
        editionId: ids.editionMena,
        function: "sponsor",
        ownerId: ids.memberSponsor,
        estimatedValue: "50000.00",
      },
      saCtx,
    );
    const speaker = await createOpportunity(
      sa,
      {
        personId: person.id,
        companyId: person.companyId,
        editionId: ids.editionMena,
        function: "speaker",
        ownerId: ids.memberSpeaker,
      },
      saCtx,
    );
    const delegate = await createOpportunity(
      sa,
      {
        personId: person.id,
        companyId: person.companyId,
        editionId: ids.editionMena,
        function: "delegate",
        ownerId: ids.memberDelegate,
      },
      saCtx,
    );

    const personRows = await tx.select({ n: sql<number>`count(*)::int` }).from(people);
    R["peopleCount"] = personRows[0]?.n;

    const oppRows = await tx.select({ n: sql<number>`count(*)::int` }).from(opportunities);
    R["opportunityCount"] = oppRows[0]?.n;

    /* Entry stages come from the database, per function. */
    const stageRows = await tx
      .select({ fn: opportunities.function, stage: opportunities.stageKey })
      .from(opportunities);
    R["entryStages"] = Object.fromEntries(stageRows.map((r) => [r.fn, r.stage]));

    /* An open duplicate workstream is refused. */
    try {
      await createOpportunity(
        sa,
        { personId: person.id, editionId: ids.editionMena, function: "sponsor" },
        saCtx,
      );
      R["duplicateOpenRefused"] = false;
    } catch (error) {
      R["duplicateOpenRefused"] = error instanceof ValidationError;
    }

    /* Each owner sees only their own workstream. */
    R["sponsorOwnerSees"] = (await listOpportunities(q("memberSponsor"))).length;
    R["speakerOwnerSees"] = (await listOpportunities(q("memberSpeaker"))).length;
    R["superAdminSees"] = (await listOpportunities(sa)).length;
    R["adminInScopeSees"] = (await listOpportunities(q("adminMena"))).length;

    /* ---- WON requires a final value ---- */
    try {
      await changeStage(sa, sponsor.id, { stageKey: "won" }, saCtx);
      R["wonWithoutValueRefused"] = false;
    } catch (error) {
      R["wonWithoutValueRefused"] = error instanceof ValidationError;
      R["wonWithoutValueMessage"] = (error as Error).message;
    }

    await changeStage(sa, sponsor.id, { stageKey: "meeting" }, saCtx);
    await changeStage(sa, sponsor.id, { stageKey: "won", finalValue: "42000.00" }, saCtx);

    const wonRows = await tx
      .select({
        stage: opportunities.stageKey,
        finalValue: opportunities.finalValue,
        wonAt: opportunities.wonAt,
        probability: opportunities.probability,
      })
      .from(opportunities)
      .where(eq(opportunities.id, sponsor.id));
    R["won"] = {
      stage: wonRows[0]?.stage,
      finalValue: wonRows[0]?.finalValue,
      hasWonAt: Boolean(wonRows[0]?.wonAt),
      probability: wonRows[0]?.probability,
    };

    /* ---- WON is terminal except for CANCELLED ---- */
    for (const [label, stageKey] of [
      ["backwards", "meeting"],
      ["lost", "lost"],
    ] as const) {
      try {
        await changeStage(sa, sponsor.id, { stageKey, lossReasonKey: "budget" }, saCtx);
        R[`wonTo_${label}_refused`] = false;
      } catch (error) {
        R[`wonTo_${label}_refused`] = error instanceof ValidationError;
      }
    }

    /* ---- CANCELLED requires a reason, and only comes from WON ---- */
    try {
      await changeStage(sa, sponsor.id, { stageKey: "cancelled" }, saCtx);
      R["cancelWithoutReasonRefused"] = false;
    } catch (error) {
      R["cancelWithoutReasonRefused"] = error instanceof ValidationError;
    }

    try {
      await changeStage(
        sa,
        speaker.id,
        { stageKey: "cancelled", cancellationReasonKey: "other" },
        saCtx,
      );
      R["speakerCancelRefused"] = false;
    } catch (error) {
      R["speakerCancelRefused"] = error instanceof ValidationError;
    }

    await changeStage(
      sa,
      sponsor.id,
      { stageKey: "cancelled", cancellationReasonKey: "non_payment" },
      saCtx,
    );
    const cancelledRows = await tx
      .select({
        stage: opportunities.stageKey,
        reason: opportunities.cancellationReasonKey,
        cancelledAt: opportunities.cancelledAt,
        finalValue: opportunities.finalValue,
      })
      .from(opportunities)
      .where(eq(opportunities.id, sponsor.id));
    R["cancelled"] = {
      stage: cancelledRows[0]?.stage,
      reason: cancelledRows[0]?.reason,
      hasCancelledAt: Boolean(cancelledRows[0]?.cancelledAt),
      finalValueKept: cancelledRows[0]?.finalValue,
    };

    /* A cancelled workstream does not block a new one (§46.3). */
    const replacement = await createOpportunity(
      sa,
      {
        personId: person.id,
        editionId: ids.editionMena,
        function: "sponsor",
        ownerId: ids.memberSponsor,
      },
      saCtx,
    );
    R["replacementCreated"] = Boolean(replacement.id);

    /* ---- LOST requires a reason ---- */
    try {
      await changeStage(sa, delegate.id, { stageKey: "declined" }, saCtx);
      R["lostWithoutReasonRefused"] = false;
    } catch (error) {
      R["lostWithoutReasonRefused"] = error instanceof ValidationError;
    }
    await changeStage(
      sa,
      delegate.id,
      { stageKey: "declined", lossReasonKey: "not_interested" },
      saCtx,
    );
    const lostRows = await tx
      .select({ reason: opportunities.lossReasonKey, lostAt: opportunities.lostAt })
      .from(opportunities)
      .where(eq(opportunities.id, delegate.id));
    R["lost"] = { reason: lostRows[0]?.reason, hasLostAt: Boolean(lostRows[0]?.lostAt) };

    /* ---- Every stage change leaves an activity and an audit row ---- */
    const acts = await tx
      .select({ type: activities.type })
      .from(activities)
      .where(eq(activities.opportunityId, sponsor.id));
    R["statusChangeActivities"] = acts.filter((a) => a.type === "status_change").length;

    const audits = await tx
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, sponsor.id));
    R["auditActions"] = audits.map((a) => a.action).sort();

    /* ---- §15 renewal: clone into the next edition ---- */
    const speakerWon = await changeStage(sa, speaker.id, { stageKey: "confirmed" }, saCtx);
    R["speakerConfirmed"] = speakerWon.stageKey;

    const renewal = await cloneIntoEdition(
      sa,
      replacement.id,
      ids.editionMena2027,
      ids.memberSponsor,
      saCtx,
    );
    const renewalRows = await tx
      .select({
        editionId: opportunities.editionId,
        stage: opportunities.stageKey,
        clonedFrom: opportunities.clonedFromId,
        personId: opportunities.personId,
      })
      .from(opportunities)
      .where(eq(opportunities.id, renewal.id));
    R["renewal"] = {
      newEdition: renewalRows[0]?.editionId === ids.editionMena2027,
      atEntryStage: renewalRows[0]?.stage,
      remembersOrigin: renewalRows[0]?.clonedFrom === replacement.id,
      samePerson: renewalRows[0]?.personId === person.id,
    };

    const finalPeople = await tx.select({ n: sql<number>`count(*)::int` }).from(people);
    R["peopleCountAtEnd"] = finalPeople[0]?.n;

    return true;
  });
});

describe("one person, three workstreams, three owners", () => {
  it("creates exactly one person", () => expect(R["peopleCount"]).toBe(1));
  it("creates three opportunities", () => expect(R["opportunityCount"]).toBe(3));
  it("each function enters at its own configured stage", () =>
    expect(R["entryStages"]).toEqual({ sponsor: "new", speaker: "research", delegate: "new" }));
  it("still one person after every stage change and a renewal", () =>
    expect(R["peopleCountAtEnd"]).toBe(1));
});

describe("visibility", () => {
  it("the sponsor owner sees only their workstream", () => expect(R["sponsorOwnerSees"]).toBe(1));
  it("the speaker owner sees only theirs", () => expect(R["speakerOwnerSees"]).toBe(1));
  it("Super Admin sees all three — NO HIDDEN LEADS", () => expect(R["superAdminSees"]).toBe(3));
  it("an Admin scoped to MENA sees all three", () => expect(R["adminInScopeSees"]).toBe(3));
});

describe("a second OPEN workstream for the same person and edition is refused", () => {
  it("refuses", () => expect(R["duplicateOpenRefused"]).toBe(true));
});

describe("WON", () => {
  it("REFUSES without a final value", () => expect(R["wonWithoutValueRefused"]).toBe(true));
  it("explains why, in terms the operator can act on", () =>
    expect(R["wonWithoutValueMessage"]).toMatch(/final contracted value/i));
  it("records the value, the timestamp and 100% probability", () =>
    expect(R["won"]).toEqual({
      stage: "won",
      finalValue: "42000.00",
      hasWonAt: true,
      probability: 100,
    }));
  it("cannot move backwards", () => expect(R["wonTo_backwards_refused"]).toBe(true));
  it("cannot become LOST", () => expect(R["wonTo_lost_refused"]).toBe(true));
});

describe("CANCELLED", () => {
  it("requires a cancellation reason", () => expect(R["cancelWithoutReasonRefused"]).toBe(true));
  it("is refused for a speaker — sponsor only", () => expect(R["speakerCancelRefused"]).toBe(true));
  it("records the reason and the timestamp, and KEEPS the final value", () =>
    expect(R["cancelled"]).toEqual({
      stage: "cancelled",
      reason: "non_payment",
      hasCancelledAt: true,
      finalValueKept: "42000.00",
    }));
  it("does not block a new sponsor workstream for the same person and edition", () =>
    expect(R["replacementCreated"]).toBe(true));
});

describe("LOST", () => {
  it("is refused without a reason", () => expect(R["lostWithoutReasonRefused"]).toBe(true));
  it("records the reason and the timestamp", () =>
    expect(R["lost"]).toEqual({ reason: "not_interested", hasLostAt: true }));
});

describe("nothing changes silently", () => {
  it("every SUCCESSFUL stage change writes a status_change activity, and every refused one writes nothing", () =>
    /* meeting, won, cancelled — three. The four refused attempts in this
       fixture (won without a value, backwards from won, won to lost, cancel
       without a reason) must leave no trace at all. */
    expect(R["statusChangeActivities"]).toBe(3));
  it("the audit trail names what actually happened", () =>
    expect(R["auditActions"]).toEqual(["cancelled", "created", "stage_changed", "won"]));
});

describe("§15 renewal into a new edition", () => {
  it("lands in the new edition", () =>
    expect((R["renewal"] as Record<string, unknown>)["newEdition"]).toBe(true));
  it("starts at the entry stage, not the stage it was cloned from", () =>
    expect((R["renewal"] as Record<string, unknown>)["atEntryStage"]).toBe("new"));
  it("remembers where it came from", () =>
    expect((R["renewal"] as Record<string, unknown>)["remembersOrigin"]).toBe(true));
  it("is the SAME person — event memory, not a new record", () =>
    expect((R["renewal"] as Record<string, unknown>)["samePerson"]).toBe(true));
});
