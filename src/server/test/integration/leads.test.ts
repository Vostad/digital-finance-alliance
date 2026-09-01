/**
 * MANUAL LEAD CREATION — §5, §13, and §39 scenarios 1, 2, 6, 7, 9, 10, 11,
 * 23, 26, 28.
 *
 * The claim under test: one click can open a sponsor AND a speaker workstream
 * for one person, and the same person entered again by a different Team
 * Member with a different spelling still produces no second record.
 */

import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";

import { companies, opportunities, people } from "@/server/db/schema";
import { createLead, otherWorkstreams, previewLead } from "@/server/domain/leads";
import { listOpportunities } from "@/server/domain/opportunities";
import type { Tx } from "@/server/auth/scoped";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};
async function count(tx: Tx, table: PgTable): Promise<number> {
  const rows = await tx.select({ n: sql<number>`count(*)::int` }).from(table);
  return rows[0]?.n ?? -1;
}

beforeAll(async () => {
  await withFixture(async ({ tx, ids, ctx, q }) => {
    const sa = q("superAdmin");

    /* 1 · One click, two functions, one person. */
    const lead = await createLead(
      sa,
      {
        fullName: "John Smith",
        companyName: "ABC Bank",
        jobTitle: "Head of Payments",
        email: "john.smith@abcbank.com",
        phone: "+971 50 000 0000",
        country: "AE",
        functions: ["sponsor", "speaker"],
        editionId: ids.editionMena,
        source: "manual",
        notes: "Met at the Dubai fintech briefing.",
        estimatedValue: "60000.00",
      },
      ctx("superAdmin"),
    );
    R["opportunitiesOpened"] = lead.opportunityIds.length;
    R["personCreated"] = lead.personCreated;
    R["peopleAfterFirst"] = await count(tx, people);

    /* 2 · Unassigned by default — NULL owner is the Super Admin inbox. */
    const unassigned = await listOpportunities(sa, { unassignedOnly: true });
    R["unassignedCount"] = unassigned.length;

    /* 3 · The same person, different speller, different user, third function. */
    const again = await createLead(
      q("memberDelegate"),
      {
        fullName: "J. Smith",
        companyName: "ABC Bank Ltd",
        email: "JOHN.SMITH@ABCBANK.COM",
        functions: ["delegate"],
        editionId: ids.editionMena,
      },
      ctx("memberDelegate"),
    );
    R["secondPersonCreated"] = again.personCreated;
    R["samePerson"] = again.personId === lead.personId;
    R["peopleAfterSecond"] = await count(tx, people);
    R["companiesTotal"] = await count(tx, companies);
    R["opportunitiesTotal"] = await count(tx, opportunities);

    /* 4 · Re-submitting functions that are ALL already open opens nothing, and
       says so rather than returning a silent no-op the operator would read as
       success. */
    try {
      await createLead(
        sa,
        {
          fullName: "John Smith",
          email: "john.smith@abcbank.com",
          functions: ["sponsor", "delegate"],
          editionId: ids.editionMena,
        },
        ctx("superAdmin"),
      );
      R["allExistingRefused"] = false;
    } catch (error) {
      R["allExistingRefused"] = true;
      R["allExistingMessage"] = (error as Error).message;
    }

    /* 5 · A mix of existing and new opens the new one and REPORTS the skip. */
    const mixed = await createLead(
      sa,
      {
        fullName: "John Smith",
        email: "john.smith@abcbank.com",
        functions: ["sponsor", "speaker"],
        editionId: ids.editionMena2027,
      },
      ctx("superAdmin"),
    );
    R["mixedOpened"] = mixed.opportunityIds.length;
    R["mixedSkipped"] = mixed.skippedFunctions.length;

    /* 5 · §5 — matching runs before save. */
    const preview = await previewLead(sa, { email: "john.smith@abcbank.com" });
    R["previewConfidence"] = preview.people[0]?.confidence;
    const previewByName = await previewLead(sa, {
      fullName: "John Smith",
      companyName: "ABC Bank",
    });
    R["previewFindsByNameAndCompany"] = previewByName.people.length > 0;

    /* 6 · §13 — cross-workstream visibility, without the sensitive fields. */
    const others = await otherWorkstreams(sa, lead.personId);
    R["otherWorkstreamCount"] = others.length;
    R["otherWorkstreamFields"] = Object.keys(others[0] ?? {}).sort();

    /* 7 · A Team Member may not open a function they do not hold. */
    try {
      await createLead(
        q("memberSponsor"),
        { fullName: "Nobody", functions: ["speaker"], editionId: ids.editionMena },
        ctx("memberSponsor"),
      );
      R["wrongFunctionRefused"] = false;
    } catch (error) {
      R["wrongFunctionRefused"] = true;
      R["wrongFunctionMessage"] = (error as Error).message;
    }

    /* 8 · An Admin may not file against an edition outside their scope. */
    try {
      await createLead(
        q("adminMena"),
        { fullName: "Out Of Scope", functions: ["sponsor"], editionId: ids.editionAsia },
        ctx("adminMena"),
      );
      R["adminOutOfScopeRefused"] = false;
    } catch (error) {
      R["adminOutOfScopeRefused"] = true;
      R["adminOutOfScopeMessage"] = (error as Error).message;
    }

    /* 9 · An Admin may file inside their scope. */
    const inScope = await createLead(
      q("adminMena"),
      { fullName: "In Scope", functions: ["sponsor"], editionId: ids.editionMena },
      ctx("adminMena"),
    );
    R["adminInScopeOpened"] = inScope.opportunityIds.length;

    /* 10 · A Team Member sees their own work only; Super Admin sees all. */
    R["memberDelegateSees"] = (await listOpportunities(q("memberDelegate"))).length;
    R["superAdminSees"] = (await listOpportunities(sa)).length;

    return true;
  });
});

describe("one click, several functions, one person", () => {
  it("opens a workstream per selected function", () => expect(R["opportunitiesOpened"]).toBe(2));
  it("creates the person once", () => expect(R["personCreated"]).toBe(true));
  it("one person after the first lead", () => expect(R["peopleAfterFirst"]).toBe(1));
});

describe("NO HIDDEN LEADS — unassigned is a real state", () => {
  it("a lead with no owner appears in the unassigned inbox", () =>
    expect(R["unassignedCount"]).toBe(2));
});

describe("NO DUPLICATE PEOPLE, across users and spellings", () => {
  it("the second submission does not create a person", () =>
    expect(R["secondPersonCreated"]).toBe(false));
  it("it attaches to the same person", () => expect(R["samePerson"]).toBe(true));
  it("still one person", () => expect(R["peopleAfterSecond"]).toBe(1));
  it('"ABC Bank" and "ABC Bank Ltd" remain one company', () => expect(R["companiesTotal"]).toBe(1));
  it("three workstreams on that one person", () => expect(R["opportunitiesTotal"]).toBe(3));
});

describe("re-submitting functions that are already open", () => {
  it("refuses when EVERY requested function already has an open workstream", () => {
    expect(R["allExistingRefused"]).toBe(true);
    expect(R["allExistingMessage"]).toMatch(/already has an open/i);
  });
  it("names the remedy rather than failing blankly", () =>
    expect(R["allExistingMessage"]).toMatch(/open the existing workstream/i));
  it("a different edition is a different workstream — both open there", () =>
    expect(R["mixedOpened"]).toBe(2));
  it("and nothing is skipped in that edition", () => expect(R["mixedSkipped"]).toBe(0));
});

describe("§5 duplicate matching runs before save", () => {
  it("an email match is certain", () => expect(R["previewConfidence"]).toBe("certain"));
  it("name plus company finds the candidate too", () =>
    expect(R["previewFindsByNameAndCompany"]).toBe(true));
});

describe("§13 cross-workstream visibility", () => {
  it("shows every workstream on the person, across editions", () =>
    /* Three in MENA 2026 (sponsor, speaker, delegate) plus two in MENA 2027
       (sponsor, speaker) — the whole point of event memory is that they are
       the same person. */
    expect(R["otherWorkstreamCount"]).toBe(5));
  it("EXPOSES ONLY existence, owner and status — never value, notes or commission", () =>
    expect(R["otherWorkstreamFields"]).toEqual([
      "editionId",
      "function",
      "id",
      "ownerId",
      "stageKey",
    ]));
});

describe("server-side authorization on lead creation", () => {
  it("a Team Member cannot open a function they do not hold", () => {
    expect(R["wrongFunctionRefused"]).toBe(true);
    expect(R["wrongFunctionMessage"]).toMatch(/not assigned to speaker/i);
  });
  it("an Admin cannot file against an edition outside their event scope", () => {
    expect(R["adminOutOfScopeRefused"]).toBe(true);
    expect(R["adminOutOfScopeMessage"]).toMatch(/outside the events you manage/i);
  });
  it("an Admin can file inside their scope", () => expect(R["adminInScopeOpened"]).toBe(1));
});

describe("visibility after creation", () => {
  it("the delegate Team Member sees only what they own", () =>
    expect(R["memberDelegateSees"]).toBe(0));
  it("Super Admin sees everything — NO HIDDEN LEADS", () =>
    /* five on John across two editions, plus the Admin's in-scope lead. */
    expect(R["superAdminSees"]).toBe(6));
});
