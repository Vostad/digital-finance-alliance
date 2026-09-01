/**
 * MANUAL LEAD CREATION — §5. First class, for every Team Member.
 *
 * A lead is not a separate entity. `+ ADD LEAD` resolves an identity and opens
 * one workstream per selected function, which is why the same click can
 * produce a sponsor and a speaker workstream for one person without ever
 * producing two people.
 *
 * THE ORDER MATTERS: company, then person, then workstreams. Each step feeds
 * the next — the email's domain identifies the company, the company sharpens
 * the person match — and all of it happens before a single opportunity row
 * exists, so a duplicate is caught while there is still nothing to unwind.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";

import { editions, opportunities, people } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext, WorkFunction } from "../auth/permissions";
import { canAccessEvent } from "../auth/permissions";
import { forbidden } from "../auth/context";
import {
  DuplicateError,
  findCompanyMatches,
  findPersonMatches,
  resolveCompany,
  resolvePerson,
  type CompanyMatch,
  type PersonMatch,
} from "./directory";
import { companyDomainFromEmail, looksLikeEmail, normalizeEmail } from "./identity";
import { ValidationError, createOpportunity } from "./opportunities";

export type LeadSource = "website" | "manual" | "import" | "referral" | "event" | "other";

/** See directory.ts — with exactOptionalPropertyTypes on, an omitted field and
    an explicitly-null one are different types, and RPC callers produce both. */
type Maybe<T> = T | null | undefined;

export type CreateLeadInput = {
  fullName: string;
  companyName?: Maybe<string>;
  companyId?: Maybe<string>;
  jobTitle?: Maybe<string>;
  email?: Maybe<string>;
  phone?: Maybe<string>;
  country?: Maybe<string>;
  functions: WorkFunction[];
  editionId: string;
  source?: Maybe<LeadSource>;
  notes?: Maybe<string>;
  estimatedValue?: Maybe<string>;
  currency?: Maybe<string>;
  ownerId?: Maybe<string>;
  /** Set by the operator after looking at the candidates §5 requires showing. */
  acceptPersonMatchId?: Maybe<string>;
  acceptCompanyMatchId?: Maybe<string>;
};

export type LeadPreview = {
  people: PersonMatch[];
  companies: CompanyMatch[];
};

/**
 * §5 — "Before saving: run duplicate matching."
 *
 * Called as the operator types, so the candidates are on screen before Save is
 * ever pressed. Deliberately cheap and read-only; it writes nothing and can be
 * called on every keystroke without consequence.
 */
export async function previewLead(
  q: ScopedQuery,
  input: { fullName?: Maybe<string>; email?: Maybe<string>; companyName?: Maybe<string> },
): Promise<LeadPreview> {
  const email = input.email && looksLikeEmail(input.email) ? normalizeEmail(input.email) : null;
  const domain = email ? companyDomainFromEmail(email) : null;

  const companies = await findCompanyMatches(q, { name: input.companyName, domain });
  const likelyCompanyId = companies.find((c) => c.confidence === "certain")?.id ?? null;

  const people = await findPersonMatches(q, {
    fullName: input.fullName,
    email,
    companyId: likelyCompanyId,
  });

  return { people, companies };
}

export type CreateLeadResult = {
  personId: string;
  companyId: string | null;
  personCreated: boolean;
  opportunityIds: string[];
  /** Which functions already had an open workstream and were therefore
      skipped rather than duplicated. Reported, never silently swallowed. */
  skippedFunctions: { function: WorkFunction; reason: string }[];
};

export async function createLead(
  q: ScopedQuery,
  input: CreateLeadInput,
  ctx: AuthContext,
): Promise<CreateLeadResult> {
  if (!input.fullName?.trim()) throw new ValidationError("A name is required.");
  if (!input.functions?.length) {
    throw new ValidationError("Choose at least one function: sponsor, delegate or speaker.");
  }
  if (!input.editionId) throw new ValidationError("Choose an event edition.");

  /* A Team Member may only open workstreams in functions they hold. Checked
     here, on the server, not by hiding the checkbox. */
  if (ctx.role === "team_member") {
    const notPermitted = input.functions.filter((f) => !ctx.functions.includes(f));
    if (notPermitted.length) {
      throw forbidden(`You are not assigned to ${notPermitted.join(" or ")} work.`);
    }
  }

  const edition = await q.directory
    .select({ id: editions.id, eventId: editions.eventId })
    .from(editions)
    .where(eq(editions.id, input.editionId))
    .limit(1);
  const found = edition[0];
  if (!found) throw new ValidationError("That edition does not exist.");

  /* An Admin is confined to their granted events. A Team Member is not scoped
     by event at all — their reach is their own workstreams. */
  if (ctx.role === "admin" && !canAccessEvent(ctx, found.eventId)) {
    throw forbidden("That edition is outside the events you manage.");
  }

  const email = input.email && looksLikeEmail(input.email) ? normalizeEmail(input.email) : null;

  /* 1 · COMPANY */
  let companyId = input.acceptCompanyMatchId ?? input.companyId ?? null;
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

  /* 2 · PERSON. resolvePerson raises DuplicateError on a strong match, which
     the RPC layer turns into the candidate list §5 requires showing. */
  const person = await resolvePerson(
    q,
    {
      fullName: input.fullName,
      email,
      jobTitle: input.jobTitle,
      phone: input.phone,
      country: input.country,
      companyId,
      acceptMatchId: input.acceptPersonMatchId ?? null,
    },
    ctx,
  );
  companyId = person.companyId ?? companyId;

  /* Backfill details onto an existing record rather than discarding them —
     a second submission often carries the phone number the first lacked. */
  if (!person.created) {
    const patch: Record<string, unknown> = {};
    if (input.jobTitle?.trim()) patch["jobTitle"] = input.jobTitle.trim();
    if (input.phone?.trim()) patch["phone"] = input.phone.trim();
    if (input.country?.trim()) patch["country"] = input.country.trim();
    if (companyId) patch["companyId"] = companyId;
    if (Object.keys(patch).length) {
      await q.directory
        .update(people)
        .set({ ...patch, updatedAt: new Date(), updatedBy: ctx.userId })
        .where(and(eq(people.id, person.id), isNull(people.mergedIntoId)));
    }
  }

  /* 3 · WORKSTREAMS, one per selected function. */
  const opportunityIds: string[] = [];
  const skippedFunctions: CreateLeadResult["skippedFunctions"] = [];

  for (const fn of input.functions) {
    try {
      const created = await createOpportunity(
        q,
        {
          personId: person.id,
          companyId,
          editionId: input.editionId,
          function: fn,
          ownerId: input.ownerId ?? null,
          source: input.source ?? "manual",
          estimatedValue: fn === "sponsor" ? (input.estimatedValue ?? null) : null,
          currency: input.currency ?? "USD",
          notes: input.notes ?? null,
        },
        ctx,
      );
      opportunityIds.push(created.id);
    } catch (error) {
      /* An existing open workstream is not a failure of the whole lead — the
         other functions still open. It IS reported back, never swallowed. */
      if (error instanceof ValidationError) {
        skippedFunctions.push({ function: fn, reason: error.message });
        continue;
      }
      throw error;
    }
  }

  if (!opportunityIds.length && skippedFunctions.length) {
    throw new ValidationError(
      skippedFunctions.map((s) => s.reason).join(" ") +
        " Nothing new was opened — open the existing workstream instead.",
    );
  }

  return {
    personId: person.id,
    companyId,
    personCreated: person.created,
    opportunityIds,
    skippedFunctions,
  };
}

/**
 * §13 — CROSS-WORKSTREAM VISIBILITY.
 *
 * What a Team Member may see about a person's OTHER workstreams: that they
 * exist, who owns them, and where they stand. Never the value, never the
 * notes, never the commission. The point is to stop two people cold-calling
 * the same person in the same week — not to open the pipeline.
 */
export async function otherWorkstreams(
  q: ScopedQuery,
  personId: string,
  excludeOpportunityId?: Maybe<string>,
) {
  const rows = await q.directory
    .select({
      id: opportunities.id,
      function: opportunities.function,
      stageKey: opportunities.stageKey,
      ownerId: opportunities.ownerId,
      editionId: opportunities.editionId,
    })
    .from(opportunities)
    .where(and(eq(opportunities.personId, personId), isNull(opportunities.archivedAt)));

  return rows.filter((r) => r.id !== excludeOpportunityId);
}

/** Editions the caller may file a lead against. */
export async function permittedEditions(q: ScopedQuery, ctx: AuthContext) {
  const rows = await q.directory
    .select({
      id: editions.id,
      name: editions.name,
      eventId: editions.eventId,
      status: editions.status,
    })
    .from(editions);

  if (ctx.role === "admin") return rows.filter((r) => canAccessEvent(ctx, r.eventId));
  return rows;
}

/** Bulk stage lookup for a set of opportunities, used by the lead screens. */
export async function stageKeysFor(q: ScopedQuery, ids: string[]) {
  if (!ids.length) return [];
  return q.directory
    .select({ id: opportunities.id, stageKey: opportunities.stageKey })
    .from(opportunities)
    .where(inArray(opportunities.id, ids));
}
