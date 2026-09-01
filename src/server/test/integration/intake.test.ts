/**
 * WEBSITE INTAKE — §6, §46.5, and §39 scenarios 20, 21, 22, plus repeated
 * submission.
 *
 * The claims: the raw submission survives no matter what, website leads arrive
 * unassigned, an existing contact is matched rather than duplicated, and email
 * failure never costs a lead.
 */

import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { emailOutbox, formSubmissions, opportunities, people } from "@/server/db/schema";
import { RateLimited, SpamRejected, receiveWebsiteLead } from "@/server/domain/intake";
import { createLead } from "@/server/domain/leads";
import { listOpportunities } from "@/server/domain/opportunities";
import { outboxSummary } from "@/server/domain/email";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};

beforeAll(async () => {
  await withFixture(async ({ tx, ids, ctx, q }) => {
    const sa = q("superAdmin");
    const system = ctx("superAdmin");

    /* The fixture's editions are `planning`; intake needs an active one. */
    /* D5 — the fixture's own edition carries the mapping. The seeded MENA
       2026 row also has key 'mena', so the fixture's must be set inside this
       transaction and the seeded one temporarily cleared: the key is UNIQUE,
       which is the constraint that makes the mapping unambiguous. */
    await tx.execute(
      sql`update editions set public_intake_key = null where public_intake_key = 'mena'`,
    );
    await tx.execute(
      sql`update editions set status = 'active', public_intake_key = 'mena' where id = ${ids.editionMena}`,
    );

    /* ---- 1 · REQUEST THE PROSPECTUS → sponsor, unassigned ---- */
    const prospectus = await receiveWebsiteLead(
      sa,
      {
        kind: "prospectus",
        intakeKey: "mena",
        name: "Layla Haddad",
        email: "layla@temenos.com",
        company: "Temenos",
        role: "Regional Director",
        elapsedMs: 9000,
        ipHash: "ip-a",
      },
      system,
    );
    R["prospectusOpportunity"] = Boolean(prospectus.opportunityId);
    R["prospectusEmailQueued"] = prospectus.emailQueued;

    const created = await tx
      .select({
        fn: opportunities.function,
        ownerId: opportunities.ownerId,
        source: opportunities.source,
        stage: opportunities.stageKey,
      })
      .from(opportunities)
      .where(eq(opportunities.id, prospectus.opportunityId!));
    R["prospectus"] = created[0];

    /* ---- 2 · APPLY TO ATTEND → delegate, unassigned ---- */
    const apply = await receiveWebsiteLead(
      sa,
      {
        kind: "apply",
        intakeKey: "mena",
        name: "Omar Said",
        email: "omar@mashreqbank.com",
        company: "Mashreq Bank",
        role: "Head of Treasury",
        notes: "Evaluating instant settlement rails.",
        elapsedMs: 12000,
        ipHash: "ip-b",
      },
      system,
    );
    const applyRow = await tx
      .select({ fn: opportunities.function, ownerId: opportunities.ownerId })
      .from(opportunities)
      .where(eq(opportunities.id, apply.opportunityId!));
    R["apply"] = applyRow[0];

    /* ---- 3 · everything website-sourced lands in the Super Admin inbox ---- */
    R["unassigned"] = (await listOpportunities(sa, { unassignedOnly: true })).length;

    /* ---- 4 · an EXISTING contact is matched, never duplicated ---- */
    const existing = await createLead(
      sa,
      {
        fullName: "Karim Nasr",
        companyName: "Emirates NBD",
        email: "karim@emiratesnbd.com",
        functions: ["speaker"],
        editionId: ids.editionMena,
      },
      system,
    );
    const peopleBefore = (await tx.select({ n: sql<number>`count(*)::int` }).from(people))[0]?.n;

    const returning = await receiveWebsiteLead(
      sa,
      {
        kind: "prospectus",
        intakeKey: "mena",
        name: "KARIM NASR",
        email: "Karim@EmiratesNBD.com",
        company: "Emirates NBD Bank",
        elapsedMs: 8000,
        ipHash: "ip-c",
      },
      system,
    );
    const peopleAfter = (await tx.select({ n: sql<number>`count(*)::int` }).from(people))[0]?.n;
    R["matchedExisting"] = returning.personId === existing.personId;
    R["noNewPerson"] = peopleBefore === peopleAfter;

    /* ---- 5 · repeated identical submission ---- */
    const repeat = await receiveWebsiteLead(
      sa,
      {
        kind: "prospectus",
        intakeKey: "mena",
        name: "Layla Haddad",
        email: "layla@temenos.com",
        company: "Temenos",
        elapsedMs: 7000,
        ipHash: "ip-d",
      },
      system,
    );
    R["repeatStoredSubmission"] = Boolean(repeat.submissionId);
    R["repeatOpenedNothingNew"] = repeat.opportunityId === null;
    const allSubs = await tx.select({ status: formSubmissions.status }).from(formSubmissions);
    R["submissionCount"] = allSubs.length;
    R["submissionStatuses"] = allSubs.map((s) => s.status).sort();

    /* ---- 6 · the RAW payload is preserved verbatim ---- */
    const raw = await tx
      .select({ raw: formSubmissions.rawPayload, email: formSubmissions.submittedEmail })
      .from(formSubmissions)
      .where(eq(formSubmissions.id, prospectus.submissionId));
    R["rawPayload"] = raw[0]?.raw;
    R["normalisedEmailStored"] = raw[0]?.email;

    /* ---- 7 · spam guards ---- */
    for (const [label, input] of [
      ["honeypot", { honeypot: "http://spam.example", elapsedMs: 9000 }],
      ["tooFast", { elapsedMs: 200 }],
    ] as const) {
      try {
        await receiveWebsiteLead(
          sa,
          {
            kind: "prospectus",
            intakeKey: "mena",
            name: "Bot",
            email: "bot@spam.test",
            company: "Spam",
            ...input,
          },
          system,
        );
        R[`spam_${label}`] = false;
      } catch (error) {
        R[`spam_${label}`] = error instanceof SpamRejected;
      }
    }
    R["spamWroteNothing"] =
      (await tx.select({ n: sql<number>`count(*)::int` }).from(formSubmissions))[0]?.n ===
      allSubs.length;

    /* ---- 8 · rate limiting, counted in the database ---- */
    let limited = false;
    for (let i = 0; i < 8; i += 1) {
      try {
        await receiveWebsiteLead(
          sa,
          {
            kind: "apply",
            intakeKey: "mena",
            name: `Flood ${i}`,
            email: `flood${i}@example.com`,
            company: "Flood",
            elapsedMs: 9000,
            ipHash: "ip-flood",
          },
          system,
        );
      } catch (error) {
        if (error instanceof RateLimited) {
          limited = true;
          break;
        }
        throw error;
      }
    }
    R["rateLimited"] = limited;

    /* ---- 9 · validation ---- */
    for (const [label, bad] of [
      ["shortName", { name: "X", email: "a@b.co" }],
      ["badEmail", { name: "Real Person", email: "not-an-email" }],
    ] as const) {
      try {
        await receiveWebsiteLead(
          sa,
          {
            kind: "prospectus",
            intakeKey: "mena",
            company: "C",
            elapsedMs: 9000,
            ipHash: "ip-v",
            ...bad,
          },
          system,
        );
        R[`invalid_${label}`] = false;
      } catch {
        R[`invalid_${label}`] = true;
      }
    }

    /* ---- 10 · §46.5 the outbox ---- */
    const outbox = await outboxSummary(tx);
    R["outbox"] = outbox;
    const messages = await tx
      .select({ kind: emailOutbox.kind, to: emailOutbox.toEmail, sentAt: emailOutbox.sentAt })
      .from(emailOutbox);
    R["outboxKinds"] = [...new Set(messages.map((m) => m.kind))].sort();
    R["nothingMarkedSent"] = messages.every((m) => m.sentAt === null);

    return true;
  });
});

describe("REQUEST THE PROSPECTUS opens a sponsor workstream", () => {
  it("creates one", () => expect(R["prospectusOpportunity"]).toBe(true));
  it("sponsor, unassigned, source website, at the entry stage", () =>
    expect(R["prospectus"]).toEqual({
      fn: "sponsor",
      ownerId: null,
      source: "website",
      stage: "new",
    }));
});

describe("APPLY TO ATTEND opens a delegate workstream", () => {
  it("delegate, unassigned", () => expect(R["apply"]).toEqual({ fn: "delegate", ownerId: null }));
});

describe("website leads are never hidden", () => {
  it("they sit in the Super Admin inbox", () => expect(R["unassigned"]).toBeGreaterThanOrEqual(2));
});

describe("an existing contact is matched, not duplicated", () => {
  it("resolves to the same person despite different case and company suffix", () =>
    expect(R["matchedExisting"]).toBe(true));
  it("creates no new person record", () => expect(R["noNewPerson"]).toBe(true));
});

describe("repeated submission", () => {
  it("STILL STORES the raw submission", () => expect(R["repeatStoredSubmission"]).toBe(true));
  it("opens nothing new — the workstream is already open", () =>
    expect(R["repeatOpenedNothingNew"]).toBe(true));
  it("and marks that submission failed so a human can see what arrived", () =>
    expect(R["submissionStatuses"]).toContain("failed"));
});

describe("the raw submission is preserved verbatim", () => {
  it("keeps exactly what was typed", () =>
    expect(R["rawPayload"]).toEqual({
      kind: "prospectus",
      name: "Layla Haddad",
      email: "layla@temenos.com",
      company: "Temenos",
      role: "Regional Director",
      notes: null,
    }));
  it("and stores a normalised address alongside for matching", () =>
    expect(R["normalisedEmailStored"]).toBe("layla@temenos.com"));
});

describe("spam guards", () => {
  it("a filled honeypot is rejected", () => expect(R["spam_honeypot"]).toBe(true));
  it("a form filled faster than a person could type is rejected", () =>
    expect(R["spam_tooFast"]).toBe(true));
  it("and neither writes anything at all", () => expect(R["spamWroteNothing"]).toBe(true));
});

describe("rate limiting", () => {
  it("stops a flood from one address", () => expect(R["rateLimited"]).toBe(true));
});

describe("validation", () => {
  it("rejects a name too short to be one", () => expect(R["invalid_shortName"]).toBe(true));
  it("rejects an address that is not one", () => expect(R["invalid_badEmail"]).toBe(true));
});

describe("§46.5 — email is queued, never sent, and never blocks a lead", () => {
  it("reports honestly that no provider is configured", () =>
    expect((R["outbox"] as Record<string, unknown>)["providerConfigured"]).toBe(false));
  it("queues both acknowledgement kinds", () =>
    expect(R["outboxKinds"]).toEqual(["application_acknowledgement", "prospectus_delivery"]));
  it("marks nothing as sent, because nothing was", () => expect(R["nothingMarkedSent"]).toBe(true));
  it("and the leads were captured regardless", () => expect(R["prospectusEmailQueued"]).toBe(true));
});
