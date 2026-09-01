/**
 * PEOPLE AND COMPANIES — §2. The half of the system that must never produce a
 * second record for someone who already exists.
 *
 * The rule, stated once:
 *
 *   ONE PERSON = ONE RECORD.  ONE COMPANY = ONE RECORD.
 *   FUNCTION AND OWNER CHANGE. THE PERSON DOES NOT.
 *
 * Three layers hold it up, and all three are needed:
 *
 *   1. DATABASE   unique indexes on lower(email) and lower(domain). These are
 *                 the only guard that survives two people clicking Save at the
 *                 same instant, so the write path is built around catching
 *                 their violation rather than around checking first.
 *   2. MATCHING   findPersonMatches / findCompanyMatches, below. A `certain`
 *                 match refuses creation outright; weaker matches are shown to
 *                 a human, who decides.
 *   3. INTERFACE  §5 requires search-before-create. The UI calls the matchers
 *                 before it will enable Save.
 *
 * Check-then-insert alone is a race, and a unique index alone gives the user a
 * database error instead of "this person already exists — here they are".
 * Together they give a correct answer under concurrency and a readable one the
 * rest of the time.
 */

import { and, desc, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import {
  companies,
  companyDomains,
  merges,
  opportunities,
  people,
  personEmails,
} from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext } from "../auth/permissions";
import { canMergeRecords } from "../auth/permissions";
import { forbidden } from "../auth/context";
import { recordAudit } from "./audit";
import {
  companyDomainFromEmail,
  looksLikeEmail,
  normalizeCompanyName,
  normalizeEmail,
  normalizeName,
  rankConfidence,
  type MatchConfidence,
} from "./identity";

/** `T | null | undefined` throughout the domain inputs. With
    exactOptionalPropertyTypes on, an omitted field and an explicitly-null one
    are different types, and every caller here legitimately produces both. */
type Maybe<T> = T | null | undefined;

/* ------------------------------------------------------------------- types */

export type PersonMatch = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  companyId: string | null;
  companyName: string | null;
  emails: string[];
  confidence: MatchConfidence;
  /** Shown verbatim in the UI. "Probable match" with no reason is not
      actionable — the person deciding needs to know what matched. */
  reason: string;
};

export type CompanyMatch = {
  id: string;
  name: string;
  country: string | null;
  domains: string[];
  confidence: MatchConfidence;
  reason: string;
};

export class DuplicateError extends Error {
  readonly statusCode = 409;
  constructor(
    message: string,
    readonly matches: PersonMatch[] | CompanyMatch[],
  ) {
    super(message);
    this.name = "DuplicateError";
  }
}

/* --------------------------------------------------------- company matching */

export async function findCompanyMatches(
  q: ScopedQuery,
  input: { name?: Maybe<string>; domain?: Maybe<string> },
): Promise<CompanyMatch[]> {
  const db = q.directory;
  const found = new Map<string, CompanyMatch>();

  /** Highest confidence wins. A company matched on its domain AND its name
      should not be downgraded by whichever query happened to run second. */
  const add = (row: CompanyMatch) => {
    const existing = found.get(row.id);
    if (!existing || rankConfidence(row.confidence) < rankConfidence(existing.confidence)) {
      found.set(row.id, row);
    }
  };

  const domain = input.domain?.trim().toLowerCase() || null;
  const rawName = input.name?.trim() || null;
  const normalized = rawName ? normalizeCompanyName(rawName) : null;

  if (domain) {
    const rows = await db
      .select({ id: companies.id, name: companies.name, country: companies.country })
      .from(companies)
      .innerJoin(companyDomains, eq(companyDomains.companyId, companies.id))
      .where(and(sql`lower(${companyDomains.domain}) = ${domain}`, isNull(companies.mergedIntoId)))
      .limit(10);
    for (const r of rows) {
      add({ ...r, domains: [], confidence: "certain", reason: `Owns the domain ${domain}` });
    }
  }

  if (normalized) {
    const rows = await db
      .select({ id: companies.id, name: companies.name, country: companies.country })
      .from(companies)
      .where(and(eq(companies.normalizedName, normalized), isNull(companies.mergedIntoId)))
      .limit(10);
    for (const r of rows) {
      add({ ...r, domains: [], confidence: "strong", reason: `Same name as "${r.name}"` });
    }

    /* Substring, for the half-typed and the abbreviated. Deliberately capped
       and deliberately only `possible` — it is a prompt to look, not a claim. */
    if (normalized.length >= 4) {
      const rows2 = await db
        .select({ id: companies.id, name: companies.name, country: companies.country })
        .from(companies)
        .where(
          and(ilike(companies.normalizedName, `%${normalized}%`), isNull(companies.mergedIntoId)),
        )
        .limit(10);
      for (const r of rows2) {
        add({ ...r, domains: [], confidence: "possible", reason: `Similar name to "${r.name}"` });
      }
    }
  }

  const ids = [...found.keys()];
  if (ids.length) {
    const domains = await db
      .select({ companyId: companyDomains.companyId, domain: companyDomains.domain })
      .from(companyDomains)
      .where(inArray(companyDomains.companyId, ids));
    for (const d of domains) found.get(d.companyId)?.domains.push(d.domain);
  }

  return [...found.values()].sort(
    (a, b) => rankConfidence(a.confidence) - rankConfidence(b.confidence),
  );
}

/* ---------------------------------------------------------- person matching */

export async function findPersonMatches(
  q: ScopedQuery,
  input: { fullName?: Maybe<string>; email?: Maybe<string>; companyId?: Maybe<string> },
): Promise<PersonMatch[]> {
  const db = q.directory;
  const found = new Map<string, PersonMatch>();

  const add = (row: PersonMatch) => {
    const existing = found.get(row.id);
    if (!existing || rankConfidence(row.confidence) < rankConfidence(existing.confidence)) {
      found.set(row.id, row);
    }
  };

  const email = input.email && looksLikeEmail(input.email) ? normalizeEmail(input.email) : null;
  const normalized = input.fullName ? normalizeName(input.fullName) : null;

  const base = {
    id: people.id,
    fullName: people.fullName,
    jobTitle: people.jobTitle,
    companyId: people.companyId,
    companyName: companies.name,
  };

  /* 1 · EMAIL. The identity key. This is the only `certain` verdict, because
     it is the only one the database itself would have refused. */
  if (email) {
    const rows = await db
      .select(base)
      .from(people)
      .innerJoin(personEmails, eq(personEmails.personId, people.id))
      .leftJoin(companies, eq(companies.id, people.companyId))
      .where(and(sql`lower(${personEmails.email}) = ${email}`, isNull(people.mergedIntoId)))
      .limit(5);
    for (const r of rows) {
      add({ ...r, emails: [], confidence: "certain", reason: `Already has the email ${email}` });
    }
  }

  /* 2 · NAME AT THE SAME COMPANY. Two Ahmed Al-Mansouris at one bank is
     possible; it is far more often the same person entered twice. */
  if (normalized && input.companyId) {
    const rows = await db
      .select(base)
      .from(people)
      .leftJoin(companies, eq(companies.id, people.companyId))
      .where(
        and(
          eq(people.normalizedName, normalized),
          eq(people.companyId, input.companyId),
          isNull(people.mergedIntoId),
        ),
      )
      .limit(10);
    for (const r of rows) {
      add({
        ...r,
        emails: [],
        confidence: "strong",
        reason: `Same name at ${r.companyName ?? "the same company"}`,
      });
    }
  }

  /* 3 · NAME ANYWHERE. Weak on purpose — people move employers, and a common
     name at a different company is usually a different person. Shown, never
     blocking. */
  if (normalized) {
    const rows = await db
      .select(base)
      .from(people)
      .leftJoin(companies, eq(companies.id, people.companyId))
      .where(and(eq(people.normalizedName, normalized), isNull(people.mergedIntoId)))
      .limit(10);
    for (const r of rows) {
      add({
        ...r,
        emails: [],
        confidence: "possible",
        reason: r.companyName ? `Same name, at ${r.companyName}` : "Same name",
      });
    }
  }

  const ids = [...found.keys()];
  if (ids.length) {
    const emails = await db
      .select({ personId: personEmails.personId, email: personEmails.email })
      .from(personEmails)
      .where(inArray(personEmails.personId, ids));
    for (const e of emails) found.get(e.personId)?.emails.push(e.email);
  }

  return [...found.values()].sort(
    (a, b) => rankConfidence(a.confidence) - rankConfidence(b.confidence),
  );
}

/* ------------------------------------------------------------- company write */

/**
 * D7 — FIND OR CREATE, WITHOUT EVER GUESSING.
 *
 * The identity key for a company is its DOMAIN. A domain match attaches
 * automatically because the database itself would have refused a second row
 * for it.
 *
 * A NAME match never attaches. `normalizeCompanyName` strips legal suffixes —
 * `Ltd`, `AG`, `Holdings`, and `Bank` — which is exactly what makes it useful
 * as a heuristic and exactly what makes it unsafe as an identity key: it
 * collapses `ABC Bank` and `ABC` into one key, and those are sometimes the
 * same institution and sometimes not. Only a human can tell, so only a human
 * decides, via `acceptMatchId`.
 *
 * When no human is present — the website path — a new company is created and
 * the collision is surfaced by `possibleDuplicateCompanies`. Creating
 * something a person will later reconcile is acceptable. Creating it
 * invisibly, or silently merging two institutions, is not.
 */
export async function resolveCompany(
  q: ScopedQuery,
  input: {
    name: string;
    domain?: Maybe<string>;
    website?: Maybe<string>;
    country?: Maybe<string>;
    /** The operator looked at the candidates and said "this one". */
    acceptMatchId?: Maybe<string>;
  },
  ctx: AuthContext | null,
): Promise<{ id: string; created: boolean; candidates: CompanyMatch[] }> {
  const db = q.directory;
  const name = input.name.trim();
  if (!name) throw new Error("Company name is required.");

  const domain = input.domain?.trim().toLowerCase() || null;
  const matches = await findCompanyMatches(q, { name, domain });

  /* 1 · DOMAIN — the identity key. Attaches without asking. */
  const certain = matches.find((m) => m.confidence === "certain");
  if (certain) return { id: certain.id, created: false, candidates: [] };

  /* 2 · A HUMAN DECIDED. Honour it, and attach the domain to what they chose. */
  if (input.acceptMatchId) {
    if (domain) await attachDomain(q, input.acceptMatchId, domain, ctx);
    return { id: input.acceptMatchId, created: false, candidates: [] };
  }

  /* 3 · NAME CANDIDATES EXIST BUT NOBODY CONFIRMED. Create, and say so. */
  const candidates = matches.filter((m) => m.confidence !== "certain");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(companies)
      .values({
        name,
        normalizedName: normalizeCompanyName(name),
        website: input.website ?? null,
        country: input.country ?? null,
        createdBy: ctx?.userId ?? null,
        updatedBy: ctx?.userId ?? null,
      })
      .returning({ id: companies.id });

    const id = row!.id;
    await recordAudit(tx, {
      ctx,
      entityType: "company",
      entityId: id,
      action: "created",
      after: {
        name,
        domain,
        /* The trail that makes an unconfirmed creation reviewable rather than
           invisible. */
        unconfirmedCandidates: candidates.map((c) => ({ id: c.id, name: c.name })),
      },
    });
    if (domain) {
      await tx
        .insert(companyDomains)
        .values({ companyId: id, domain, isPrimary: true, createdBy: ctx?.userId ?? null })
        .onConflictDoNothing();
    }
    return { id, created: true, candidates };
  });
}

/** Idempotent. A domain already owned by another company is left alone — one
    domain belongs to one company, and silently moving it would re-parent every
    person matched through it. */
async function attachDomain(
  q: ScopedQuery,
  companyId: string,
  domain: string,
  ctx: AuthContext | null,
) {
  await q.directory
    .insert(companyDomains)
    .values({ companyId, domain, createdBy: ctx?.userId ?? null })
    .onConflictDoNothing();
}

/* -------------------------------------------------------------- person write */

export type CreatePersonInput = {
  fullName: string;
  email?: Maybe<string>;
  jobTitle?: Maybe<string>;
  phone?: Maybe<string>;
  country?: Maybe<string>;
  companyId?: Maybe<string>;
  companyName?: Maybe<string>;
};

/**
 * Create a person, or refuse and hand back who already exists.
 *
 * `acceptMatchId` is how a human resolves a non-certain match: they looked at
 * the candidates, decided it is the same person, and passed the id. There is
 * deliberately no "create anyway" flag for a CERTAIN match — an email already
 * in the table belongs to exactly one person by definition.
 */
export async function resolvePerson(
  q: ScopedQuery,
  input: CreatePersonInput & { acceptMatchId?: Maybe<string> },
  ctx: AuthContext | null,
): Promise<{ id: string; created: boolean; companyId: string | null }> {
  const db = q.directory;
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Person name is required.");

  const email = input.email && looksLikeEmail(input.email) ? normalizeEmail(input.email) : null;

  let companyId = input.companyId ?? null;
  if (!companyId && input.companyName?.trim()) {
    const company = await resolveCompany(
      q,
      {
        name: input.companyName,
        domain: email ? companyDomainFromEmail(email) : null,
        country: input.country ?? null,
      },
      ctx,
    );
    companyId = company.id;
  }

  if (input.acceptMatchId) {
    const person = await attachEmail(q, input.acceptMatchId, email, ctx);
    return { id: person, created: false, companyId };
  }

  const matches = await findPersonMatches(q, { fullName, email, companyId });
  const certain = matches.find((m) => m.confidence === "certain");
  if (certain) {
    /* Not an error to the caller — the email IS this person. Return them and
       let the workstream attach. This is what stops a second John Smith. */
    return { id: certain.id, created: false, companyId: certain.companyId ?? companyId };
  }

  const strong = matches.filter((m) => m.confidence === "strong");
  if (strong.length) {
    throw new DuplicateError(
      `${strong.length === 1 ? "A person" : `${strong.length} people`} with this name already exist${strong.length === 1 ? "s" : ""} at this company.`,
      strong,
    );
  }

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(people)
        .values({
          fullName,
          normalizedName: normalizeName(fullName),
          jobTitle: input.jobTitle ?? null,
          phone: input.phone ?? null,
          country: input.country ?? null,
          companyId,
          isVerified: Boolean(email),
          createdBy: ctx?.userId ?? null,
          updatedBy: ctx?.userId ?? null,
        })
        .returning({ id: people.id });

      const id = row!.id;
      if (email) {
        await tx.insert(personEmails).values({
          personId: id,
          email,
          isPrimary: true,
          createdBy: ctx?.userId ?? null,
        });
      }
      await recordAudit(tx, {
        ctx,
        entityType: "person",
        entityId: id,
        action: "created",
        after: { fullName, email, companyId },
      });
      return { id, created: true, companyId };
    });
  } catch (error) {
    /* CONCURRENCY. Two people clicked Save on the same person at the same
       instant; the unique index on lower(email) refused the second. Re-read
       and return the winner — the caller wanted a person with this email and
       there now is one. */
    if (email && isUniqueViolation(error)) {
      const again = await findPersonMatches(q, { email });
      const winner = again.find((m) => m.confidence === "certain");
      if (winner)
        return { id: winner.id, created: false, companyId: winner.companyId ?? companyId };
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error != null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/** Add an address to an existing person. Idempotent, and never steals an
    address that already belongs to somebody else. */
export async function attachEmail(
  q: ScopedQuery,
  personId: string,
  email: string | null,
  ctx: AuthContext | null,
): Promise<string> {
  if (!email) return personId;
  const owner = await findPersonMatches(q, { email });
  const certain = owner.find((m) => m.confidence === "certain");
  if (certain) return certain.id;

  await q.directory
    .insert(personEmails)
    .values({ personId, email, createdBy: ctx?.userId ?? null })
    .onConflictDoNothing();
  await q.directory
    .update(people)
    .set({ isVerified: true, updatedAt: new Date(), updatedBy: ctx?.userId ?? null })
    .where(eq(people.id, personId));
  return personId;
}

/* -------------------------------------------------------------------- merge */

/**
 * D6 — MERGE, AND UN-MERGE. Both genuinely implemented.
 *
 * Nothing is ever deleted. The loser keeps its row, gains `merged_into_id`,
 * and stops surfacing as a match. Every foreign key that was repointed is
 * written into the `merges` snapshot, which is what makes the reversal EXACT
 * rather than approximate: un-merging moves back precisely the rows that
 * moved, and leaves alone anything that already belonged to the survivor.
 *
 * A reversal that guessed — "move every email back" — would steal the
 * survivor's own addresses the first time the two records genuinely shared a
 * company. The snapshot is the difference between reversible and destructive.
 */

/** How long a merge may be undone. §2. */
export const MERGE_REVERSAL_WINDOW_DAYS = 30;

type MergeSnapshot = {
  /** Table → the ids whose foreign key this merge actually moved. */
  moved: Record<string, string[]>;
  /** Restored verbatim on reversal — the loser's own state before the merge. */
  source: { archivedAt: string | null; companyId?: string | null };
};

async function assertCanMerge(ctx: AuthContext, sourceId: string, targetId: string) {
  if (!canMergeRecords(ctx)) throw forbidden("You cannot merge records.");
  if (sourceId === targetId) throw new Error("Cannot merge a record into itself.");
}

export async function mergePeople(
  q: ScopedQuery,
  sourceId: string,
  targetId: string,
  ctx: AuthContext,
): Promise<{ mergeId: string; moved: Record<string, number> }> {
  await assertCanMerge(ctx, sourceId, targetId);

  return q.directory.transaction(async (tx) => {
    const before = await tx
      .select({ archivedAt: people.archivedAt, mergedIntoId: people.mergedIntoId })
      .from(people)
      .where(eq(people.id, sourceId))
      .limit(1);
    const source = before[0];
    if (!source) throw new Error("That person does not exist.");
    if (source.mergedIntoId) throw new Error("That person has already been merged.");

    const movedEmails = await tx
      .update(personEmails)
      .set({ personId: targetId, isPrimary: false })
      .where(eq(personEmails.personId, sourceId))
      .returning({ id: personEmails.id });

    const movedOpps = await tx
      .update(opportunities)
      .set({ personId: targetId, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(eq(opportunities.personId, sourceId))
      .returning({ id: opportunities.id });

    await tx
      .update(people)
      .set({
        mergedIntoId: targetId,
        archivedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(people.id, sourceId));

    const snapshot: MergeSnapshot = {
      moved: {
        person_emails: movedEmails.map((r) => r.id),
        opportunities: movedOpps.map((r) => r.id),
      },
      source: { archivedAt: source.archivedAt?.toISOString() ?? null },
    };

    const [mergeRow] = await tx
      .insert(merges)
      .values({
        entityType: "person",
        sourceId,
        targetId,
        snapshot,
        performedBy: ctx.userId,
        createdBy: ctx.userId,
      })
      .returning({ id: merges.id });

    await recordAudit(tx, {
      ctx,
      entityType: "person",
      entityId: sourceId,
      action: "merged",
      before: { mergedIntoId: null },
      after: { mergedIntoId: targetId, mergeId: mergeRow!.id, moved: snapshot.moved },
    });

    return {
      mergeId: mergeRow!.id,
      moved: {
        person_emails: movedEmails.length,
        opportunities: movedOpps.length,
      },
    };
  });
}

export async function mergeCompanies(
  q: ScopedQuery,
  sourceId: string,
  targetId: string,
  ctx: AuthContext,
): Promise<{ mergeId: string; moved: Record<string, number> }> {
  await assertCanMerge(ctx, sourceId, targetId);

  return q.directory.transaction(async (tx) => {
    const before = await tx
      .select({ archivedAt: companies.archivedAt, mergedIntoId: companies.mergedIntoId })
      .from(companies)
      .where(eq(companies.id, sourceId))
      .limit(1);
    const source = before[0];
    if (!source) throw new Error("That company does not exist.");
    if (source.mergedIntoId) throw new Error("That company has already been merged.");

    const movedDomains = await tx
      .update(companyDomains)
      .set({ companyId: targetId, isPrimary: false })
      .where(eq(companyDomains.companyId, sourceId))
      .returning({ id: companyDomains.id });

    const movedPeople = await tx
      .update(people)
      .set({ companyId: targetId, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(eq(people.companyId, sourceId))
      .returning({ id: people.id });

    const movedOpps = await tx
      .update(opportunities)
      .set({ companyId: targetId, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(eq(opportunities.companyId, sourceId))
      .returning({ id: opportunities.id });

    await tx
      .update(companies)
      .set({
        mergedIntoId: targetId,
        archivedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(companies.id, sourceId));

    const snapshot: MergeSnapshot = {
      moved: {
        company_domains: movedDomains.map((r) => r.id),
        people: movedPeople.map((r) => r.id),
        opportunities: movedOpps.map((r) => r.id),
      },
      source: { archivedAt: source.archivedAt?.toISOString() ?? null },
    };

    const [mergeRow] = await tx
      .insert(merges)
      .values({
        entityType: "company",
        sourceId,
        targetId,
        snapshot,
        performedBy: ctx.userId,
        createdBy: ctx.userId,
      })
      .returning({ id: merges.id });

    await recordAudit(tx, {
      ctx,
      entityType: "company",
      entityId: sourceId,
      action: "merged",
      before: { mergedIntoId: null },
      after: { mergedIntoId: targetId, mergeId: mergeRow!.id, moved: snapshot.moved },
    });

    return {
      mergeId: mergeRow!.id,
      moved: {
        company_domains: movedDomains.length,
        people: movedPeople.length,
        opportunities: movedOpps.length,
      },
    };
  });
}

/**
 * Undo a merge, exactly.
 *
 * Only the rows this merge moved go back, identified by id from the snapshot.
 * Anything the survivor already owned, and anything added since, is untouched.
 */
export async function reverseMerge(
  q: ScopedQuery,
  mergeId: string,
  ctx: AuthContext,
): Promise<{ restored: Record<string, number> }> {
  if (!canMergeRecords(ctx)) throw forbidden("You cannot reverse a merge.");

  return q.directory.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: merges.id,
        entityType: merges.entityType,
        sourceId: merges.sourceId,
        targetId: merges.targetId,
        snapshot: merges.snapshot,
        performedAt: merges.performedAt,
        reversedAt: merges.reversedAt,
      })
      .from(merges)
      .where(eq(merges.id, mergeId))
      .limit(1);

    const merge = rows[0];
    if (!merge) throw new Error("That merge does not exist.");
    if (merge.reversedAt) throw new Error("That merge has already been reversed.");

    const ageDays = (Date.now() - merge.performedAt.getTime()) / 86_400_000;
    if (ageDays > MERGE_REVERSAL_WINDOW_DAYS) {
      throw new Error(
        `That merge is ${Math.floor(ageDays)} days old. Merges can be reversed for ${MERGE_REVERSAL_WINDOW_DAYS} days, after which the records are treated as genuinely one.`,
      );
    }

    const snapshot = merge.snapshot as MergeSnapshot;
    const restored: Record<string, number> = {};
    const ids = (table: string) => snapshot.moved[table] ?? [];

    if (merge.entityType === "person") {
      const emailIds = ids("person_emails");
      if (emailIds.length) {
        const back = await tx
          .update(personEmails)
          .set({ personId: merge.sourceId })
          .where(inArray(personEmails.id, emailIds))
          .returning({ id: personEmails.id });
        restored["person_emails"] = back.length;
      }
      const oppIds = ids("opportunities");
      if (oppIds.length) {
        const back = await tx
          .update(opportunities)
          .set({ personId: merge.sourceId, updatedAt: new Date(), updatedBy: ctx.userId })
          .where(inArray(opportunities.id, oppIds))
          .returning({ id: opportunities.id });
        restored["opportunities"] = back.length;
      }
      await tx
        .update(people)
        .set({
          mergedIntoId: null,
          archivedAt: snapshot.source.archivedAt ? new Date(snapshot.source.archivedAt) : null,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(people.id, merge.sourceId));
    } else {
      const domainIds = ids("company_domains");
      if (domainIds.length) {
        const back = await tx
          .update(companyDomains)
          .set({ companyId: merge.sourceId })
          .where(inArray(companyDomains.id, domainIds))
          .returning({ id: companyDomains.id });
        restored["company_domains"] = back.length;
      }
      const peopleIds = ids("people");
      if (peopleIds.length) {
        const back = await tx
          .update(people)
          .set({ companyId: merge.sourceId, updatedAt: new Date(), updatedBy: ctx.userId })
          .where(inArray(people.id, peopleIds))
          .returning({ id: people.id });
        restored["people"] = back.length;
      }
      const oppIds = ids("opportunities");
      if (oppIds.length) {
        const back = await tx
          .update(opportunities)
          .set({ companyId: merge.sourceId, updatedAt: new Date(), updatedBy: ctx.userId })
          .where(inArray(opportunities.id, oppIds))
          .returning({ id: opportunities.id });
        restored["opportunities"] = back.length;
      }
      await tx
        .update(companies)
        .set({
          mergedIntoId: null,
          archivedAt: snapshot.source.archivedAt ? new Date(snapshot.source.archivedAt) : null,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(companies.id, merge.sourceId));
    }

    await tx
      .update(merges)
      .set({ reversedAt: new Date(), reversedBy: ctx.userId })
      .where(eq(merges.id, mergeId));

    await recordAudit(tx, {
      ctx,
      entityType: merge.entityType === "person" ? "person" : "company",
      entityId: merge.sourceId,
      action: "merge_reversed",
      before: { mergedIntoId: merge.targetId },
      after: { mergedIntoId: null, mergeId, restored },
    });

    return { restored };
  });
}

/** Merges still inside the reversal window, newest first. */
export async function reversibleMerges(q: ScopedQuery, limit = 50) {
  const cutoff = new Date(Date.now() - MERGE_REVERSAL_WINDOW_DAYS * 86_400_000);
  return q.directory
    .select({
      id: merges.id,
      entityType: merges.entityType,
      sourceId: merges.sourceId,
      targetId: merges.targetId,
      performedAt: merges.performedAt,
      performedBy: merges.performedBy,
    })
    .from(merges)
    .where(and(isNull(merges.reversedAt), gte(merges.performedAt, cutoff)))
    .orderBy(desc(merges.performedAt))
    .limit(limit);
}

/* --------------------------------------------------- possible duplicates (D7) */

/**
 * The review queue D7 requires.
 *
 * Name normalisation is never allowed to attach records automatically, so
 * collisions accumulate — mostly from the unattended website path, where no
 * human was present to confirm. This surfaces them. Computed on demand rather
 * than stored, so it is always accurate and a merge removes an entry from it
 * without any bookkeeping.
 */
export async function possibleDuplicateCompanies(q: ScopedQuery, limit = 50) {
  const rows = await q.directory.execute(sql`
    select c.normalized_name,
           json_agg(json_build_object('id', c.id, 'name', c.name, 'country', c.country)
                    order by c.created_at) as records
    from companies c
    where c.merged_into_id is null and c.archived_at is null
    group by c.normalized_name
    having count(*) > 1
    order by count(*) desc
    limit ${limit}
  `);
  return rows as unknown as { normalized_name: string; records: { id: string; name: string }[] }[];
}

export async function possibleDuplicatePeople(q: ScopedQuery, limit = 50) {
  const rows = await q.directory.execute(sql`
    select p.normalized_name, p.company_id,
           json_agg(json_build_object('id', p.id, 'name', p.full_name, 'jobTitle', p.job_title)
                    order by p.created_at) as records
    from people p
    where p.merged_into_id is null and p.archived_at is null
    group by p.normalized_name, p.company_id
    having count(*) > 1
    order by count(*) desc
    limit ${limit}
  `);
  return rows as unknown as {
    normalized_name: string;
    company_id: string | null;
    records: { id: string; name: string }[];
  }[];
}

/* ------------------------------------------------------------------ reading */

/** §14 global search across the directory. Permissions are not applied here
    because these tables carry none — see scoped.ts `directory`. */
export async function searchDirectory(q: ScopedQuery, term: string, limit = 20) {
  const needle = term.trim();
  if (needle.length < 2) return { people: [], companies: [] };
  const like = `%${normalizeName(needle)}%`;
  const rawLike = `%${needle}%`;

  const [peopleRows, companyRows] = await Promise.all([
    q.directory
      .select({
        id: people.id,
        fullName: people.fullName,
        jobTitle: people.jobTitle,
        companyName: companies.name,
        phone: people.phone,
      })
      .from(people)
      .leftJoin(companies, eq(companies.id, people.companyId))
      .leftJoin(personEmails, eq(personEmails.personId, people.id))
      .where(
        and(
          isNull(people.mergedIntoId),
          or(
            ilike(people.normalizedName, like),
            ilike(personEmails.email, rawLike),
            ilike(people.phone, rawLike),
            ilike(companies.normalizedName, like),
          ),
        ),
      )
      .limit(limit),
    q.directory
      .select({
        id: companies.id,
        name: companies.name,
        country: companies.country,
      })
      .from(companies)
      .where(and(isNull(companies.mergedIntoId), ilike(companies.normalizedName, like)))
      .limit(limit),
  ]);

  /* The email join multiplies a person by their address count. */
  const seen = new Set<string>();
  const uniquePeople = peopleRows.filter((p) => !seen.has(p.id) && seen.add(p.id));

  return { people: uniquePeople, companies: companyRows };
}
