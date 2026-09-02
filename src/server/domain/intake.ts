/**
 * WEBSITE LEAD INTAKE — §6.
 *
 * The only unauthenticated write path in the system. Everything else requires
 * a session; this receives whatever the open internet sends, so it carries its
 * own validation, rate limiting and spam guard rather than relying on any of
 * the protections the authenticated surface enjoys.
 *
 * THE ORDER IS DELIBERATE:
 *
 *   1. record the raw submission, verbatim, ALWAYS
 *   2. then match, resolve and open a workstream
 *   3. then queue the acknowledgement
 *
 * Step 1 first because §6 requires the raw submission preserved even when the
 * rest fails. A form that was filled in and then lost to a transient database
 * error is a lost customer nobody knows about. Step 3 last, and its failure is
 * swallowed, because §46.5 says email must never prevent lead creation.
 */

import { and, eq, gte, sql } from "drizzle-orm";

import { editions, formSubmissions } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { WorkFunction } from "../auth/permissions";
import { applicationAcknowledgement, deliverNow, prospectusDelivery, queue } from "./email";
import { looksLikeEmail, normalizeEmail } from "./identity";
import { createLead } from "./leads";
import { ValidationError } from "./opportunities";
import type { AuthContext } from "../auth/permissions";

export type FormKind = "prospectus" | "apply";

type Maybe<T> = T | null | undefined;

export type IntakeInput = {
  kind: FormKind;
  /** D5 — which public form this came from. Resolved server-side to exactly
      one edition; never inferred from which edition happens to be active. */
  intakeKey: string;
  name: string;
  email: string;
  company: string;
  /** Job title on the prospectus form, "title" on the apply form. */
  role?: Maybe<string>;
  /** Free text from the apply form: what they are evaluating. */
  notes?: Maybe<string>;
  /** Anti-bot. A real person never fills a hidden field. */
  honeypot?: Maybe<string>;
  /** Milliseconds the form was on screen. Bots submit instantly. */
  elapsedMs?: Maybe<number>;
  ipHash?: Maybe<string>;
  userAgent?: Maybe<string>;
};

export class SpamRejected extends Error {
  readonly statusCode = 202;
  constructor() {
    /* Deliberately the same message a success returns. Telling a bot it was
       detected only teaches whoever wrote it what to change. */
    super("Thank you — we have your request.");
    this.name = "SpamRejected";
  }
}

export class RateLimited extends Error {
  readonly statusCode = 429;
  constructor() {
    super("That is a lot of requests in a short time. Try again in a few minutes.");
    this.name = "RateLimited";
  }
}

const MIN_FILL_MS = 2_500;
const RATE_WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;

/** The workstream each form opens. §6, fixed. */
const FUNCTION_FOR: Record<FormKind, WorkFunction> = {
  prospectus: "sponsor",
  apply: "delegate",
};

/**
 * Rate limit on the hashed IP, counted in the database rather than in memory.
 * Serverless functions are many and short-lived; an in-process counter would
 * reset on every cold start and limit nothing.
 */
async function assertUnderRateLimit(q: ScopedQuery, ipHash: string | null) {
  if (!ipHash) return;
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const rows = await q.directory
    .select({ n: sql<number>`count(*)::int` })
    .from(formSubmissions)
    .where(and(eq(formSubmissions.ipHash, ipHash), gte(formSubmissions.createdAt, since)));
  if ((rows[0]?.n ?? 0) >= MAX_PER_WINDOW) throw new RateLimited();
}

export type IntakeResult = {
  submissionId: string;
  personId: string | null;
  opportunityId: string | null;
  /** The intent was recorded. True even when delivery fails. */
  emailQueued: boolean;
  /** The provider accepted it. False when no provider is configured. */
  emailSent: boolean;
};

/**
 * `q` here is an UNSCOPED query built for the system actor: there is no user.
 * The workstream is created with `ownerId: null`, which puts it straight into
 * the Super Admin inbox — §6 requires website leads arrive unassigned.
 */
export async function receiveWebsiteLead(
  q: ScopedQuery,
  input: IntakeInput,
  systemCtx: AuthContext,
): Promise<IntakeResult> {
  /* ---- 0 · cheap rejections, before anything is written ---- */
  if (input.honeypot?.trim()) throw new SpamRejected();
  if (input.elapsedMs != null && input.elapsedMs < MIN_FILL_MS) throw new SpamRejected();

  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  if (name.length < 2) throw new ValidationError("Please give your full name.");
  if (!looksLikeEmail(email)) throw new ValidationError("Please give a valid email address.");
  if (name.length > 200 || email.length > 320) throw new ValidationError("That is too long.");

  await assertUnderRateLimit(q, input.ipHash ?? null);

  /* ---- 1 · the raw submission, verbatim, before anything can fail ---- */
  const [submission] = await q.directory
    .insert(formSubmissions)
    .values({
      formType: input.kind,
      rawPayload: {
        kind: input.kind,
        name: input.name,
        email: input.email,
        company: input.company,
        role: input.role ?? null,
        notes: input.notes ?? null,
      },
      submittedEmail: normalizeEmail(email),
      status: "processed",
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
    })
    .returning({ id: formSubmissions.id });

  const submissionId = submission!.id;

  /* ---- 2 · match, resolve, open the workstream ---- */
  let personId: string | null = null;
  let opportunityId: string | null = null;

  try {
    const edition = await editionForIntakeKey(q, input.intakeKey);
    if (!edition) {
      /* Refused deliberately rather than falling back to a guess. The raw
         submission above is already stored, so nothing is lost — a Super Admin
         sees exactly what arrived and which key had no mapping. */
      throw new ValidationError(
        `No edition is mapped to the intake key "${input.intakeKey}". Configure the mapping before this form goes live.`,
      );
    }
    if (edition.status !== "active") {
      throw new ValidationError(`${edition.name} is not currently accepting submissions.`);
    }

    const lead = await createLead(
      q,
      {
        fullName: name,
        companyName: input.company?.trim() || null,
        jobTitle: input.role?.trim() || null,
        email,
        functions: [FUNCTION_FOR[input.kind]],
        editionId: edition.id,
        source: "website",
        notes: input.notes?.trim() || null,
        /* UNASSIGNED. §6 — it lands in the Super Admin inbox. */
        ownerId: null,
      },
      systemCtx,
    );

    personId = lead.personId;
    opportunityId = lead.opportunityIds[0] ?? null;

    await q.directory
      .update(formSubmissions)
      .set({ personId, opportunityId })
      .where(eq(formSubmissions.id, submissionId));
  } catch (error) {
    /* The raw submission survives with its status marked, so a Super Admin can
       see exactly what arrived and act on it by hand. Nothing is lost. */
    await q.directory
      .update(formSubmissions)
      .set({ status: "failed" })
      .where(eq(formSubmissions.id, submissionId));

    /* An already-open workstream is not a failure of the submission — the
       person asked again, which is information, not an error. */
    if (!(error instanceof ValidationError)) throw error;
  }

  /* ---- 3 · the acknowledgement. Its failure changes nothing above. ---- */
  const message =
    input.kind === "prospectus"
      ? prospectusDelivery({ name, company: input.company?.trim() || null })
      : applicationAcknowledgement({ name });

  const queued = await queue(q.directory, {
    ...message,
    to: normalizeEmail(email),
    relatedEntityType: "form_submission",
    relatedEntityId: submissionId,
  });

  /* Send it now, so the acknowledgement arrives while the visitor is still on
     the page. Awaited rather than fired and forgotten — a serverless function
     can be frozen the instant it returns, and a floating promise is simply
     lost. Everything above is already committed, so a failure here costs the
     acknowledgement and nothing else; the row stays queued for the next drain. */
  const emailSent = queued ? await deliverNow(q.directory, queued) : false;

  return {
    submissionId,
    personId,
    opportunityId,
    emailQueued: Boolean(queued),
    emailSent,
  };
}

/**
 * D5 — THE EXPLICIT EDITION MAPPING.
 *
 * A public form declares an intake key; this resolves that key to exactly one
 * edition through `editions.public_intake_key`. `/forums/mena` maps to MENA
 * 2026, and nothing else does.
 *
 * The previous implementation picked "whichever edition is currently active,
 * preferring MENA". That is a silent choice: the moment two editions are
 * active it files leads against one of them arbitrarily, and the mistake is
 * only discovered after the leads are in the wrong place. An unmapped key is
 * refused instead — loudly, and with the raw submission still stored.
 */
export async function editionForIntakeKey(q: ScopedQuery, intakeKey: string) {
  const rows = await q.directory
    .select({ id: editions.id, name: editions.name, status: editions.status })
    .from(editions)
    .where(eq(editions.publicIntakeKey, intakeKey))
    .limit(1);
  return rows[0] ?? null;
}
