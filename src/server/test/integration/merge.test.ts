/**
 * D6 · REVERSIBLE MERGE and D7 · NAME IS NEVER AN IDENTITY KEY.
 *
 * These two rulings exist because the same heuristic that finds a duplicate
 * would, if trusted, silently fuse two different institutions. So the heuristic
 * only ever proposes, and every fusion it proposes can be undone exactly.
 */

import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { companies, companyDomains, merges, people, personEmails } from "@/server/db/schema";
import {
  MERGE_REVERSAL_WINDOW_DAYS,
  findCompanyMatches,
  mergeCompanies,
  mergePeople,
  possibleDuplicateCompanies,
  resolveCompany,
  resolvePerson,
  reverseMerge,
  reversibleMerges,
} from "@/server/domain/directory";
import { createLead } from "@/server/domain/leads";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};

beforeAll(async () => {
  await withFixture(async ({ tx, ids, ctx, q }) => {
    const sa = q("superAdmin");
    const saCtx = ctx("superAdmin");

    /* ---------------- D7 · a name match never attaches ---------------- */

    const abcBank = await resolveCompany(sa, { name: "ABC Bank", domain: "abcbank.com" }, saCtx);
    R["firstCompanyCreated"] = abcBank.created;

    /* "ABC" normalises to the same key as "ABC Bank" — `bank` is a stripped
       suffix. It must NOT attach. */
    const abc = await resolveCompany(sa, { name: "ABC" }, saCtx);
    R["nameOnlyCreatedSeparate"] = abc.created;
    R["nameOnlyDifferentId"] = abc.id !== abcBank.id;
    R["nameOnlyReportedCandidates"] = abc.candidates.length > 0;
    R["candidateConfidence"] = abc.candidates[0]?.confidence;

    /* The SAME domain, however, IS the identity key and attaches silently. */
    const sameDomain = await resolveCompany(
      sa,
      { name: "Completely Different Name", domain: "abcbank.com" },
      saCtx,
    );
    R["domainAttached"] = sameDomain.id === abcBank.id && !sameDomain.created;

    /* A human confirming the candidate attaches it. */
    const confirmed = await resolveCompany(
      sa,
      { name: "ABC", acceptMatchId: abcBank.id, domain: "abc-group.com" },
      saCtx,
    );
    R["humanConfirmedAttached"] = confirmed.id === abcBank.id && !confirmed.created;
    const domainsNow = await tx
      .select({ domain: companyDomains.domain })
      .from(companyDomains)
      .where(eq(companyDomains.companyId, abcBank.id));
    R["confirmedDomainAttached"] = domainsNow.map((d) => d.domain).sort();

    /* The collision is SURFACED rather than hidden. */
    const dupes = await possibleDuplicateCompanies(sa);
    R["duplicateQueueHasIt"] = dupes.some((d) => d.normalized_name === "abc");

    /* The matcher still finds it as a candidate — that is its whole job. */
    const matches = await findCompanyMatches(sa, { name: "ABC Bank Limited" });
    R["heuristicStillFinds"] = matches.length > 0;
    R["heuristicNeverCertain"] = matches.every((m) => m.confidence !== "certain");

    /* ---------------- D6 · merge, and un-merge exactly ---------------- */

    const keep = await resolvePerson(
      sa,
      { fullName: "Karim Nasr", email: "karim@abcbank.com", companyId: abcBank.id },
      saCtx,
    );
    const stray = await resolvePerson(
      sa,
      { fullName: "K. Nasr", email: "k.nasr@personal.example", companyId: abc.id },
      saCtx,
    );
    await createLead(
      sa,
      {
        fullName: "K. Nasr",
        email: "k.nasr@personal.example",
        functions: ["sponsor"],
        editionId: ids.editionMena,
      },
      saCtx,
    );

    const emailsBefore = await tx
      .select({ id: personEmails.id })
      .from(personEmails)
      .where(eq(personEmails.personId, keep.id));
    R["survivorEmailsBefore"] = emailsBefore.length;

    const merged = await mergePeople(sa, stray.id, keep.id, saCtx);
    R["mergeMoved"] = merged.moved;

    const afterMerge = await tx
      .select({ mergedIntoId: people.mergedIntoId, archivedAt: people.archivedAt })
      .from(people)
      .where(eq(people.id, stray.id));
    R["loserSurvives"] = Boolean(afterMerge[0]);
    R["loserPointsAtWinner"] = afterMerge[0]?.mergedIntoId === keep.id;

    const snapshotRow = await tx
      .select({ snapshot: merges.snapshot, entityType: merges.entityType })
      .from(merges)
      .where(eq(merges.id, merged.mergeId));
    R["snapshotWritten"] = Boolean(snapshotRow[0]?.snapshot);
    R["snapshotNamesMovedIds"] = Object.keys(
      (snapshotRow[0]?.snapshot as { moved: Record<string, string[]> })?.moved ?? {},
    ).sort();

    const pending = await reversibleMerges(sa);
    R["appearsInReversibleList"] = pending.some((m) => m.id === merged.mergeId);

    /* THE REVERSAL. */
    const reversed = await reverseMerge(sa, merged.mergeId, saCtx);
    R["reversedCounts"] = reversed.restored;

    const afterReversal = await tx
      .select({ mergedIntoId: people.mergedIntoId, archivedAt: people.archivedAt })
      .from(people)
      .where(eq(people.id, stray.id));
    R["loserRestored"] = afterReversal[0]?.mergedIntoId === null;
    R["loserUnarchived"] = afterReversal[0]?.archivedAt === null;

    /* THE POINT OF THE SNAPSHOT: the survivor keeps what was always theirs. */
    const survivorEmailsAfter = await tx
      .select({ id: personEmails.id })
      .from(personEmails)
      .where(eq(personEmails.personId, keep.id));
    R["survivorKeptOwnEmails"] = survivorEmailsAfter.length === emailsBefore.length;

    const strayEmailsAfter = await tx
      .select({ email: personEmails.email })
      .from(personEmails)
      .where(eq(personEmails.personId, stray.id));
    R["loserGotItsOwnEmailBack"] = strayEmailsAfter.map((e) => e.email);

    /* A reversal cannot happen twice. */
    try {
      await reverseMerge(sa, merged.mergeId, saCtx);
      R["doubleReversalRefused"] = false;
    } catch {
      R["doubleReversalRefused"] = true;
    }
    R["noLongerReversible"] = !(await reversibleMerges(sa)).some((m) => m.id === merged.mergeId);

    /* ---------------- company merge, and its reversal ---------------- */

    const companyMerge = await mergeCompanies(sa, abc.id, abcBank.id, saCtx);
    R["companyMergeMoved"] = companyMerge.moved;
    const abcAfter = await tx
      .select({ mergedIntoId: companies.mergedIntoId })
      .from(companies)
      .where(eq(companies.id, abc.id));
    R["companyLoserPoints"] = abcAfter[0]?.mergedIntoId === abcBank.id;

    /* The duplicate queue clears itself — no bookkeeping required. */
    R["duplicateQueueClears"] = !(await possibleDuplicateCompanies(sa)).some(
      (d) => d.normalized_name === "abc",
    );

    const companyReversed = await reverseMerge(sa, companyMerge.mergeId, saCtx);
    R["companyReversedCounts"] = companyReversed.restored;
    const abcRestored = await tx
      .select({ mergedIntoId: companies.mergedIntoId })
      .from(companies)
      .where(eq(companies.id, abc.id));
    R["companyLoserRestored"] = abcRestored[0]?.mergedIntoId === null;

    /* Nothing was ever deleted. */
    const totals = await tx.select({ n: sql<number>`count(*)::int` }).from(companies);
    R["companiesStillPresent"] = totals[0]?.n;

    /* A Team Member can neither merge nor reverse. */
    const member = q("memberSponsor");
    const memberCtx = ctx("memberSponsor");
    try {
      await mergeCompanies(member, abc.id, abcBank.id, memberCtx);
      R["memberCouldMerge"] = true;
    } catch {
      R["memberCouldMerge"] = false;
    }
    const second = await mergePeople(sa, stray.id, keep.id, saCtx);
    try {
      await reverseMerge(member, second.mergeId, memberCtx);
      R["memberCouldReverse"] = true;
    } catch {
      R["memberCouldReverse"] = false;
    }

    R["windowDays"] = MERGE_REVERSAL_WINDOW_DAYS;
    return true;
  });
});

describe("D7 — company name is a heuristic, never an identity key", () => {
  it("creates the first company", () => expect(R["firstCompanyCreated"]).toBe(true));

  it('"ABC" does NOT silently attach to "ABC Bank", even though `bank` is stripped', () => {
    expect(R["nameOnlyCreatedSeparate"]).toBe(true);
    expect(R["nameOnlyDifferentId"]).toBe(true);
  });

  it("but it REPORTS the candidate rather than pretending none existed", () => {
    expect(R["nameOnlyReportedCandidates"]).toBe(true);
    expect(R["candidateConfidence"]).not.toBe("certain");
  });

  it("the matcher still finds name candidates — that is its job", () => {
    expect(R["heuristicStillFinds"]).toBe(true);
  });

  it("and NEVER rates a name match as certain", () => {
    expect(R["heuristicNeverCertain"]).toBe(true);
  });

  it("a DOMAIN match does attach — that is the identity key", () =>
    expect(R["domainAttached"]).toBe(true));

  it("a human confirming the candidate attaches it, and carries the domain across", () => {
    expect(R["humanConfirmedAttached"]).toBe(true);
    expect(R["confirmedDomainAttached"]).toEqual(["abc-group.com", "abcbank.com"]);
  });

  it("the unconfirmed collision is SURFACED in the review queue", () =>
    expect(R["duplicateQueueHasIt"]).toBe(true));
});

describe("D6 — merge is genuinely reversible", () => {
  it("moves the loser's emails and workstreams", () =>
    expect(R["mergeMoved"]).toEqual({ person_emails: 1, opportunities: 1 }));

  it("never deletes the loser", () => {
    expect(R["loserSurvives"]).toBe(true);
    expect(R["loserPointsAtWinner"]).toBe(true);
  });

  it("writes a snapshot naming exactly what moved", () => {
    expect(R["snapshotWritten"]).toBe(true);
    expect(R["snapshotNamesMovedIds"]).toEqual(["opportunities", "person_emails"]);
  });

  it("lists the merge as reversible", () => expect(R["appearsInReversibleList"]).toBe(true));

  it("REVERSES it, restoring exactly what moved", () =>
    expect(R["reversedCounts"]).toEqual({ person_emails: 1, opportunities: 1 }));

  it("the loser is un-merged and un-archived", () => {
    expect(R["loserRestored"]).toBe(true);
    expect(R["loserUnarchived"]).toBe(true);
  });

  it("THE SURVIVOR KEEPS ITS OWN EMAILS — the snapshot is why", () => {
    /* A reversal that guessed "move every email back" would steal the
       survivor's own address. This is the difference between reversible and
       destructive. */
    expect(R["survivorKeptOwnEmails"]).toBe(true);
    expect(R["loserGotItsOwnEmailBack"]).toEqual(["k.nasr@personal.example"]);
  });

  it("cannot be reversed twice", () => expect(R["doubleReversalRefused"]).toBe(true));
  it("and drops off the reversible list", () => expect(R["noLongerReversible"]).toBe(true));
  it("the window is 30 days", () => expect(R["windowDays"]).toBe(30));
});

describe("D6 — companies merge and un-merge too", () => {
  it("moves people and workstreams, and no domains — because it never had any", () =>
    /* `abc` owns zero domains: the domain a human confirmed earlier attached
       to `abcBank`, which is the correct company. That zero is evidence D7
       worked, not an omission. */
    expect(R["companyMergeMoved"]).toEqual({
      company_domains: 0,
      people: 1,
      opportunities: 1,
    }));
  it("the loser survives, pointing at the winner", () =>
    expect(R["companyLoserPoints"]).toBe(true));
  it("the duplicate queue clears itself with no bookkeeping", () =>
    expect(R["duplicateQueueClears"]).toBe(true));
  it("reverses exactly what moved, and nothing that did not", () =>
    /* No `company_domains` key at all — zero rows moved, so zero rows are
       restored and none of the survivor's domains are disturbed. */
    expect(R["companyReversedCounts"]).toEqual({ people: 1, opportunities: 1 }));
  it("and restores the loser", () => expect(R["companyLoserRestored"]).toBe(true));
  it("nothing was ever deleted", () => expect(R["companiesStillPresent"]).toBeGreaterThan(1));
});

describe("only a Super Admin or Admin may merge", () => {
  it("a Team Member cannot merge", () => expect(R["memberCouldMerge"]).toBe(false));
  it("a Team Member cannot reverse a merge", () => expect(R["memberCouldReverse"]).toBe(false));
});
