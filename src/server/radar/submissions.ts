/**
 * THE MODERATION GATE — "Submit a source" and "Report inaccuracy".
 *
 * These are the only public writes in Rails Radar, and they write to exactly
 * one table that never renders. A submission is an unverified claim from the
 * open internet; it is not data. An editor reads it, checks the source, and
 * then writes the real record themselves through the admin surface.
 *
 * THERE IS DELIBERATELY NO PROMOTE FUNCTION. Nothing here can write to a live
 * field, and no code path elsewhere turns a submission row into one. The
 * closest the system gets is an editor reading the claimed URL and typing what
 * they found — which is the point, because the verification is the product.
 *
 * The submitter is told "submitted for verification", never "added".
 *
 * Spam handling mirrors src/rpc/intake.ts, which is the established pattern
 * here: honeypot, minimum fill time, and a rate limit counted in the database
 * rather than in memory — serverless functions are many and short-lived, so an
 * in-process counter resets on every cold start and limits nothing.
 */

import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "../db/client";
import { radarCorridors, radarProviders, radarRoutes, radarSubmissions } from "../db/radar";

export class SubmissionSpamRejected extends Error {
  readonly statusCode = 202;
  constructor() {
    /* The same message a success returns. Telling a bot it was detected only
       teaches whoever wrote it what to change. */
    super("Thank you — submitted for verification.");
    this.name = "SubmissionSpamRejected";
  }
}

export class SubmissionRateLimited extends Error {
  readonly statusCode = 429;
  constructor() {
    super("That is a lot of submissions in a short time. Try again in a few minutes.");
    this.name = "SubmissionRateLimited";
  }
}

export class SubmissionInvalid extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "SubmissionInvalid";
  }
}

const MIN_FILL_MS = 2_500;
const RATE_WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;

export type SubmissionInput = {
  kind: "source" | "inaccuracy";
  corridorSlug?: string | null;
  providerSlug?: string | null;
  routeId?: string | null;
  subjectNote?: string | null;
  claimedSourceUrl?: string | null;
  submitterEmail: string;
  message?: string | null;
  honeypot?: string | null;
  elapsedMs?: number | null;
  ipHash?: string | null;
  userAgent?: string | null;
};

/** Deliberately permissive. Bouncing a real contribution over an apostrophe in
    an address costs more than accepting one address that turns out to be dead. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * A claimed source must at least be an http(s) URL. It is NOT fetched, and it
 * is NOT trusted — an editor opens it by hand. This only rejects the obviously
 * unusable so the queue stays readable.
 */
function looksLikeUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function assertUnderRateLimit(ipHash: string | null): Promise<void> {
  if (!ipHash) return;
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(radarSubmissions)
    .where(and(eq(radarSubmissions.ipHash, ipHash), gte(radarSubmissions.createdAt, since)));
  if ((rows[0]?.n ?? 0) >= MAX_PER_WINDOW) throw new SubmissionRateLimited();
}

export type SubmissionResult = {
  id: string;
  /** Always this wording. The record is pending; nothing has been added. */
  status: "submitted for verification";
};

export async function receiveSubmission(input: SubmissionInput): Promise<SubmissionResult> {
  /* ---- 0 · cheap rejections, before anything is written ---- */
  if (input.honeypot?.trim()) throw new SubmissionSpamRejected();
  if (typeof input.elapsedMs === "number" && input.elapsedMs < MIN_FILL_MS) {
    throw new SubmissionSpamRejected();
  }

  const email = input.submitterEmail?.trim() ?? "";
  if (!looksLikeEmail(email)) {
    throw new SubmissionInvalid("Enter an email address we can reach you at to verify this.");
  }

  const claimed = input.claimedSourceUrl?.trim() || null;
  /* A source submission without a source is the one thing this form exists to
     collect, so it is required there and optional on an inaccuracy report. */
  if (input.kind === "source" && !claimed) {
    throw new SubmissionInvalid("A source URL is required — that is what gets verified.");
  }
  if (claimed && !looksLikeUrl(claimed)) {
    throw new SubmissionInvalid("The source must be a link starting http:// or https://");
  }

  await assertUnderRateLimit(input.ipHash ?? null);

  /* ---- 1 · resolve what it refers to. Unknown slugs are not an error: the
            note still carries the submitter's meaning and an editor can read
            it. Dropping a contribution over a typo would be the worse bug. ---- */
  const corridorId = input.corridorSlug
    ? ((
        await db
          .select({ id: radarCorridors.id })
          .from(radarCorridors)
          .where(eq(radarCorridors.slug, input.corridorSlug))
          .limit(1)
      )[0]?.id ?? null)
    : null;

  const providerId = input.providerSlug
    ? ((
        await db
          .select({ id: radarProviders.id })
          .from(radarProviders)
          .where(eq(radarProviders.slug, input.providerSlug))
          .limit(1)
      )[0]?.id ?? null)
    : null;

  const routeId = input.routeId
    ? ((
        await db
          .select({ id: radarRoutes.id })
          .from(radarRoutes)
          .where(eq(radarRoutes.id, input.routeId))
          .limit(1)
      )[0]?.id ?? null)
    : null;

  /* ---- 2 · record it. PENDING, always. There is no other status on insert. ---- */
  const inserted = await db
    .insert(radarSubmissions)
    .values({
      kind: input.kind,
      corridorId,
      providerId,
      routeId,
      subjectNote: input.subjectNote?.trim() || null,
      claimedSourceUrl: claimed,
      submitterEmail: email,
      message: input.message?.trim() || null,
      status: "pending",
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning({ id: radarSubmissions.id });

  const id = inserted[0]?.id;
  if (!id) throw new SubmissionInvalid("That did not save. Try again.");

  return { id, status: "submitted for verification" };
}
