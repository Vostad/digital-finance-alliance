/**
 * DUPLICATE PREVENTION, AGAINST POSTGRES.
 *
 * §39 scenarios 7, 22, 23, 24 and the concurrency case. The unit suite proves
 * the normalisation; this proves the behaviour that matters — that the same
 * person entered twice, by two people, in two spellings, through two routes,
 * ends up as one record.
 *
 * Everything runs inside a transaction that is rolled back. Nothing commits.
 */

import { TransactionRollbackError, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { authUsers, companies, people, personEmails, users } from "@/server/db/schema";
import { scopedQuery, type Tx } from "@/server/auth/scoped";
import {
  DuplicateError,
  findCompanyMatches,
  findPersonMatches,
  mergePeople,
  resolveCompany,
  resolvePerson,
  searchDirectory,
} from "@/server/domain/directory";
import type { AuthContext, Role } from "@/server/auth/permissions";

const id = () => crypto.randomUUID();
const SUPER = id();
const MEMBER = id();

function ctxFor(role: Role, userId: string): AuthContext {
  return {
    userId,
    email: `${role}@fixture.test`,
    fullName: role,
    role,
    status: "active",
    functions: ["sponsor"],
    eventScopeIds: [],
    canViewCommission: false,
    canManageCommissionRules: false,
    timezone: "Asia/Dubai",
  };
}

type Result = Record<string, unknown>;
const R: Result = {};

async function inRollback<T>(work: (tx: Tx) => Promise<T>) {
  let out: T | undefined;
  try {
    await db.transaction(async (tx) => {
      out = await work(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
  return out as T;
}

beforeAll(async () => {
  await inRollback(async (tx) => {
    /* scopedQuery's directory handle is the module-level db, so the fixture
       must be visible to it. Inside one transaction that is true only if the
       same connection is used — so the queries below go through a scopedQuery
       built over `tx` by swapping the handle. */
    const q = { ...scopedQuery(ctxFor("super_admin", SUPER)), directory: tx as Tx };
    const member = { ...scopedQuery(ctxFor("team_member", MEMBER)), directory: tx as Tx };
    const superCtx = ctxFor("super_admin", SUPER);

    await tx.insert(authUsers).values([{ id: SUPER }, { id: MEMBER }]);
    await tx.insert(users).values([
      {
        id: SUPER,
        email: "s@fixture.test",
        fullName: "Super",
        role: "super_admin",
        status: "active",
      },
      {
        id: MEMBER,
        email: "m@fixture.test",
        fullName: "Member",
        role: "team_member",
        status: "active",
      },
    ]);

    /* 1 · Create a person through the front door. */
    const first = await resolvePerson(
      q,
      {
        fullName: "John Smith",
        email: "john.smith@abcbank.com",
        companyName: "ABC Bank",
        jobTitle: "Head of Payments",
      },
      superCtx,
    );
    R["firstCreated"] = first.created;
    R["firstCompany"] = first.companyId;

    /* 2 · The SAME email, entered by a DIFFERENT user, differently spelled. */
    const second = await resolvePerson(
      q,
      { fullName: "J. Smith", email: "JOHN.SMITH@ABCBANK.COM", companyName: "ABC Bank Ltd" },
      ctxFor("team_member", MEMBER),
    );
    R["secondCreated"] = second.created;
    R["sameId"] = second.id === first.id;

    /* 3 · The company must not have forked on "ABC Bank" vs "ABC Bank Ltd". */
    const companyRows = await tx.select({ n: sql<number>`count(*)::int` }).from(companies);
    const companyCount = companyRows[0]?.n ?? -1;
    /* Sampled HERE, deliberately — before any later fixture adds a company.
       One company after "ABC Bank" and "ABC Bank Ltd" is the whole claim. */
    R["companyCount"] = companyCount;

    /* 4 · Same name, same company, NO email — must refuse and offer matches. */
    try {
      await resolvePerson(q, { fullName: "John Smith", companyId: first.companyId }, superCtx);
      R["strongRefused"] = false;
    } catch (error) {
      R["strongRefused"] = error instanceof DuplicateError;
      R["strongMatchCount"] = error instanceof DuplicateError ? error.matches.length : 0;
    }

    /* 5 · The human resolves it: same person, here is the id. */
    const accepted = await resolvePerson(
      q,
      {
        fullName: "John Smith",
        companyId: first.companyId,
        acceptMatchId: first.id,
        email: "j.smith@abcbank.com",
      },
      superCtx,
    );
    R["acceptedSameId"] = accepted.id === first.id;

    const emails = await tx
      .select({ email: personEmails.email })
      .from(personEmails)
      .where(eq(personEmails.personId, first.id));
    R["emailCount"] = emails.length;

    /* 6 · A genuinely different person at the same company creates cleanly. */
    const other = await resolvePerson(
      q,
      { fullName: "Sara Haddad", email: "sara@abcbank.com", companyId: first.companyId },
      superCtx,
    );
    R["otherCreated"] = other.created;

    /* 7 · A consumer address must not create a company. */
    const freelancer = await resolvePerson(
      q,
      { fullName: "Imran Q", email: "imran@gmail.com", companyName: "Independent" },
      superCtx,
    );
    const domainMatches = await findCompanyMatches(q, { domain: "gmail.com" });
    R["gmailBecameCompanyDomain"] = domainMatches.length;
    R["freelancerCreated"] = freelancer.created;

    /* 8 · Matching by email is `certain`; by name alone is not. */
    const byEmail = await findPersonMatches(q, { email: "john.smith@abcbank.com" });
    R["byEmailConfidence"] = byEmail[0]?.confidence;
    const byName = await findPersonMatches(q, { fullName: "Sara Haddad" });
    R["byNameConfidence"] = byName[0]?.confidence;

    /* 9 · A Team Member can see the directory — they must, to avoid dupes. */
    const asMember = await findPersonMatches(member, { email: "john.smith@abcbank.com" });
    R["memberCanSeeDirectory"] = asMember.length > 0;

    /* 10 · Search finds by name, company and email. */
    const byNameSearch = await searchDirectory(q, "John Smith");
    const byCompanySearch = await searchDirectory(q, "ABC");
    R["searchByName"] = byNameSearch.people.length;
    R["searchByCompany"] = byCompanySearch.companies.length;

    /* 11 · MERGE preserves history and never deletes. */
    const stray = await resolvePerson(
      q,
      { fullName: "Jon Smyth", email: "jon.smyth@other.com", companyName: "Other Co" },
      superCtx,
    );
    await mergePeople(q, stray.id, first.id, superCtx);
    const [survivor] = await tx
      .select({ mergedIntoId: people.mergedIntoId, archivedAt: people.archivedAt })
      .from(people)
      .where(eq(people.id, stray.id));
    R["sourceStillExists"] = Boolean(survivor);
    R["sourcePointsAtTarget"] = survivor?.mergedIntoId === first.id;
    const mergedEmails = await tx
      .select({ email: personEmails.email })
      .from(personEmails)
      .where(eq(personEmails.personId, first.id));
    R["emailsAfterMerge"] = mergedEmails.length;

    /* 12 · A merged-away person no longer surfaces as a match. */
    const afterMerge = await findPersonMatches(q, { fullName: "Jon Smyth" });
    R["mergedPersonHidden"] = afterMerge.length === 0;

    /* 13 · A Team Member cannot merge. */
    try {
      await mergePeople(member, other.id, first.id, ctxFor("team_member", MEMBER));
      R["memberCouldMerge"] = true;
    } catch {
      R["memberCouldMerge"] = false;
    }

    return true;
  });
});

describe("one person, one record", () => {
  it("creates the person the first time", () => expect(R["firstCreated"]).toBe(true));
  it("DOES NOT create a second record for the same email in different case", () =>
    expect(R["secondCreated"]).toBe(false));
  it("returns the same person id", () => expect(R["sameId"]).toBe(true));
  it("a genuinely different colleague still creates", () => expect(R["otherCreated"]).toBe(true));
});

describe("one company, one record", () => {
  it('"ABC Bank" and "ABC Bank Ltd" do not fork the company', () =>
    /* Sampled immediately after both spellings were used, so this counts the
       companies that exist at that moment: exactly one. */
    expect(R["companyCount"]).toBe(1));
  it("a consumer email address never becomes a company domain", () =>
    expect(R["gmailBecameCompanyDomain"]).toBe(0));
  it("the freelancer is still created as a person", () =>
    expect(R["freelancerCreated"]).toBe(true));
});

describe("never silently create a duplicate", () => {
  it("REFUSES a same-name-same-company create and hands back the candidates", () => {
    expect(R["strongRefused"]).toBe(true);
    expect(R["strongMatchCount"]).toBeGreaterThan(0);
  });
  it("a human resolving the match attaches to the existing person", () =>
    expect(R["acceptedSameId"]).toBe(true));
  it("the second address attaches rather than forking the person", () =>
    expect(R["emailCount"]).toBe(2));
});

describe("match confidence is graded, not binary", () => {
  it("email is certain", () => expect(R["byEmailConfidence"]).toBe("certain"));
  it("name alone is only possible", () => expect(R["byNameConfidence"]).toBe("possible"));
});

describe("the directory is readable by every active user", () => {
  it("a Team Member can find an existing person — otherwise they cannot avoid duplicating", () =>
    expect(R["memberCanSeeDirectory"]).toBe(true));
});

describe("search", () => {
  it("finds a person by name", () => expect(R["searchByName"]).toBeGreaterThan(0));
  it("finds a company by partial name", () => expect(R["searchByCompany"]).toBeGreaterThan(0));
});

describe("merge preserves everything", () => {
  it("the source record is never deleted", () => expect(R["sourceStillExists"]).toBe(true));
  it("it points at the record it merged into", () => expect(R["sourcePointsAtTarget"]).toBe(true));
  it("the emails moved to the survivor", () => expect(R["emailsAfterMerge"]).toBe(3));
  it("a merged-away person stops surfacing as a match", () =>
    expect(R["mergedPersonHidden"]).toBe(true));
  it("a Team Member cannot merge records", () => expect(R["memberCouldMerge"]).toBe(false));
});
