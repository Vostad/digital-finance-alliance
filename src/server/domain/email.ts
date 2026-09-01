/**
 * TRANSACTIONAL EMAIL — §18, §46.5.
 *
 * Every message is WRITTEN to the outbox first, then sent. With no provider
 * configured it is written and not sent, and the build reports that as an open
 * gap rather than pretending mail went out.
 *
 * Two rules this file exists to guarantee:
 *
 *   1. LEAD CREATION NEVER FAILS BECAUSE EMAIL FAILED. `queue` is called after
 *      the lead is committed and its own failure is caught. A prospectus
 *      request that reached the database is a captured lead whether or not the
 *      acknowledgement was delivered.
 *   2. NO `mailto:`. Ever. A mailto hands the work to the visitor's mail client
 *      and captures nothing.
 */

import { and, asc, eq, isNull } from "drizzle-orm";

import { emailOutbox } from "../db/schema";
import type { DirectoryHandle } from "../auth/scoped";

export type EmailKind =
  "invite" | "password_reset" | "prospectus_delivery" | "application_acknowledgement";

export type QueuedEmail = {
  kind: EmailKind;
  to: string;
  subject: string;
  body: string;
  payload?: Record<string, unknown>;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

/** True only when a provider is actually configured. Read at call time so
    wiring one in needs no code change here. */
export function emailProviderConfigured(): boolean {
  return Boolean(process.env["EMAIL_PROVIDER_API_KEY"] && process.env["EMAIL_FROM_ADDRESS"]);
}

/**
 * Write the intent. Returns the outbox id, or null if even the write failed —
 * and a null return is never allowed to abort the caller.
 */
export async function queue(db: DirectoryHandle, email: QueuedEmail): Promise<string | null> {
  try {
    const [row] = await db
      .insert(emailOutbox)
      .values({
        kind: email.kind,
        toEmail: email.to,
        subject: email.subject,
        body: email.body,
        payload: email.payload ?? null,
        relatedEntityType: email.relatedEntityType ?? null,
        relatedEntityId: email.relatedEntityId ?? null,
      })
      .returning({ id: emailOutbox.id });
    return row?.id ?? null;
  } catch (error) {
    /* The lead is already committed. Losing the acknowledgement is a
       degradation; losing the lead would be a failure. */
    console.error("[email] could not queue message", error);
    return null;
  }
}

/**
 * The send step, deliberately separate. Nothing calls it yet because no
 * provider is configured — see docs/fr-os/dns-email-authentication.md for the
 * DNS that must exist first, and the build log for the open gap.
 */
export async function drainOutbox(db: DirectoryHandle, limit = 50) {
  if (!emailProviderConfigured()) {
    return { sent: 0, skipped: "no provider configured" as const };
  }

  const pending = await db
    .select({ id: emailOutbox.id, to: emailOutbox.toEmail })
    .from(emailOutbox)
    .where(and(isNull(emailOutbox.sentAt), isNull(emailOutbox.failedAt)))
    .orderBy(asc(emailOutbox.createdAt))
    .limit(limit);

  /* The provider call goes here. Left unimplemented on purpose rather than
     stubbed to look successful — a fake send is worse than an honest gap. */
  void pending;
  return { sent: 0, skipped: "provider integration not implemented" as const };
}

/* ------------------------------------------------------------- the messages */

export function prospectusDelivery(input: {
  name: string;
  company: string | null;
}): Omit<QueuedEmail, "to"> {
  return {
    kind: "prospectus_delivery",
    subject: "Financial Rails Summit MENA — partnership prospectus",
    body: [
      `${input.name},`,
      "",
      "Thank you for requesting the partnership prospectus for Financial Rails Summit MENA, Dubai, 18-19 November 2026.",
      "",
      "A member of the team will send it to you directly and answer any questions about the room and the format.",
      "",
      "Financial Rails",
    ].join("\n"),
    payload: { name: input.name, company: input.company },
  };
}

export function applicationAcknowledgement(input: { name: string }): Omit<QueuedEmail, "to"> {
  return {
    kind: "application_acknowledgement",
    subject: "Financial Rails Summit MENA — your application",
    body: [
      `${input.name},`,
      "",
      "Thank you for applying to attend Financial Rails Summit MENA, Dubai, 18-19 November 2026.",
      "",
      "Attendance is capped and every application is reviewed individually. The team will be in touch about your place.",
      "",
      "Financial Rails",
    ].join("\n"),
    payload: { name: input.name },
  };
}

export function invitation(input: { name: string; link: string }): Omit<QueuedEmail, "to"> {
  return {
    kind: "invite",
    subject: "Your Financial Rails OS account",
    body: [
      `${input.name},`,
      "",
      "An account has been created for you on Financial Rails OS.",
      "",
      `Set your password: ${input.link}`,
      "",
      "Financial Rails",
    ].join("\n"),
    payload: { name: input.name },
  };
}

/** Unsent messages, for the Super Admin to see that the gap is real and
    exactly how many acknowledgements are waiting on a provider. */
export async function outboxSummary(db: DirectoryHandle) {
  const rows = await db
    .select({ id: emailOutbox.id, kind: emailOutbox.kind, createdAt: emailOutbox.createdAt })
    .from(emailOutbox)
    .where(isNull(emailOutbox.sentAt))
    .orderBy(asc(emailOutbox.createdAt))
    .limit(200);

  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);

  return {
    providerConfigured: emailProviderConfigured(),
    unsent: rows.length,
    byKind: Object.fromEntries(byKind),
    oldest: rows[0]?.createdAt ?? null,
  };
}
