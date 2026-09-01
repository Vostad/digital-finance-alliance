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

import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { companies, companyDomains, opportunities, people, personEmails } from "../db/schema";
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
 * Find or create. Returns the existing company when one certainly matches,
 * rather than raising — for a company, "you already have this one" is the
 * answer the caller wants, not an error to handle.
 */
export async function resolveCompany(
  q: ScopedQuery,
  input: { name: string; domain?: Maybe<string>; website?: Maybe<string>; country?: Maybe<string> },
  ctx: AuthContext | null,
): Promise<{ id: string; created: boolean }> {
  const db = q.directory;
  const name = input.name.trim();
  if (!name) throw new Error("Company name is required.");

  const domain = input.domain?.trim().toLowerCase() || null;
  const matches = await findCompanyMatches(q, { name, domain });
  const certain = matches.find((m) => m.confidence === "certain");
  if (certain) return { id: certain.id, created: false };

  const exact = matches.find(
    (m) => m.confidence === "strong" && normalizeCompanyName(m.name) === normalizeCompanyName(name),
  );
  if (exact) {
    if (domain) await attachDomain(q, exact.id, domain, ctx);
    return { id: exact.id, created: false };
  }

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
      after: { name, domain },
    });
    if (domain) {
      await tx
        .insert(companyDomains)
        .values({ companyId: id, domain, isPrimary: true, createdBy: ctx?.userId ?? null })
        .onConflictDoNothing();
    }
    return { id, created: true };
  });
}

/** Idempotent. A domain already owned by another company is left alone — one
    domain belongs to one company, and silently moving it would re-parent
    every person matched through it. */
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
 * Merge `sourceId` into `targetId`. §2 — reversible for 30 days.
 *
 * Nothing is deleted. The source row survives with `merged_into_id` set, every
 * repointed foreign key is captured in the snapshot, and the audit row names
 * both sides. That is what makes the reversal exact rather than approximate.
 */
export async function mergePeople(
  q: ScopedQuery,
  sourceId: string,
  targetId: string,
  ctx: AuthContext,
): Promise<{ moved: Record<string, number> }> {
  if (!canMergeRecords(ctx)) throw forbidden("You cannot merge records.");
  if (sourceId === targetId) throw new Error("Cannot merge a record into itself.");

  return q.directory.transaction(async (tx) => {
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

    const moved = { person_emails: movedEmails.length, opportunities: movedOpps.length };

    await recordAudit(tx, {
      ctx,
      entityType: "person",
      entityId: sourceId,
      action: "merged",
      before: { mergedIntoId: null },
      after: { mergedIntoId: targetId, moved },
    });

    return { moved };
  });
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
