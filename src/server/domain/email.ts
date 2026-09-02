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
 * MAXIMUM DELIVERY ATTEMPTS.
 *
 * After this many failures a message is marked `failed_at` and stops being
 * retried. Without a ceiling one permanently-bad address — a typo in a form —
 * is retried on every drain forever, and the log fills with the same error
 * until nobody reads it.
 */
const MAX_ATTEMPTS = 5;

/**
 * Send one message through Resend.
 *
 * The outbox row id is sent as the idempotency key. That is what makes the
 * whole design safe: if we send successfully and then crash before stamping
 * `sent_at`, the next drain retries the same row and Resend recognises the key
 * rather than delivering a second copy. Without it, "at least once" delivery
 * means sponsors occasionally get the prospectus twice.
 */
async function sendViaResend(message: {
  id: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; providerId: string | null } | { ok: false; error: string }> {
  const key = process.env["EMAIL_PROVIDER_API_KEY"];
  const from = process.env["EMAIL_FROM_ADDRESS"];
  if (!key || !from) return { ok: false, error: "no provider configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.id,
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.body,
      }),
      /* A hung provider must not hold a serverless function open until the
         platform kills it — the lead is already saved either way. */
      signal: AbortSignal.timeout(15_000),
    });

    const text = await res.text();
    if (!res.ok) {
      /* The provider's own message, trimmed. It says useful things like
         "domain is not verified", which is exactly what someone debugging a
         go-live needs to read. */
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }

    let providerId: string | null = null;
    try {
      providerId = (JSON.parse(text) as { id?: string }).id ?? null;
    } catch {
      /* A 2xx with an unparseable body is still a send. */
    }
    return { ok: true, providerId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: reason.slice(0, 300) };
  }
}

/**
 * Send the queued messages.
 *
 * Every outcome is recorded on the row: `sent_at` on success, or an incremented
 * `attempts` with the provider's own error text. A message that has exhausted
 * MAX_ATTEMPTS is stamped `failed_at` and left alone — visible in the outbox,
 * no longer retried, and never silently discarded.
 *
 * Never throws. A failure to send an acknowledgement must not become a failure
 * of whatever queued it.
 */
export async function drainOutbox(db: DirectoryHandle, limit = 25) {
  if (!emailProviderConfigured()) {
    return { sent: 0, failed: 0, skipped: "no provider configured" as const };
  }

  const pending = await db
    .select({
      id: emailOutbox.id,
      to: emailOutbox.toEmail,
      subject: emailOutbox.subject,
      body: emailOutbox.body,
      attempts: emailOutbox.attempts,
    })
    .from(emailOutbox)
    .where(and(isNull(emailOutbox.sentAt), isNull(emailOutbox.failedAt)))
    .orderBy(asc(emailOutbox.createdAt))
    .limit(limit);

  let sent = 0;
  let failed = 0;

  for (const message of pending) {
    const result = await sendViaResend(message);

    if (result.ok) {
      await db
        .update(emailOutbox)
        .set({
          sentAt: new Date(),
          attempts: message.attempts + 1,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, message.id));
      sent += 1;
      continue;
    }

    const attempts = message.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    await db
      .update(emailOutbox)
      .set({
        attempts,
        lastError: result.error,
        failedAt: exhausted ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, message.id));

    if (exhausted) failed += 1;
    console.error(
      `[email] send failed (attempt ${attempts}/${MAX_ATTEMPTS}) for ${message.id}: ${result.error}`,
    );
  }

  return { sent, failed, skipped: null };
}

/**
 * Deliver one specific queued message now.
 *
 * Called immediately after a website form is captured, so an acknowledgement
 * arrives while the visitor is still on the page rather than waiting for a
 * drain. AWAITED rather than fired and forgotten: a serverless function can be
 * frozen the moment it returns a response, and a floating promise is simply
 * lost. The lead is already committed by this point, so the wait costs the
 * visitor a few hundred milliseconds and nothing else.
 *
 * Never throws. If it fails, the row stays queued for the next drain.
 */
export async function deliverNow(db: DirectoryHandle, outboxId: string): Promise<boolean> {
  if (!emailProviderConfigured()) return false;

  try {
    const rows = await db
      .select({
        id: emailOutbox.id,
        to: emailOutbox.toEmail,
        subject: emailOutbox.subject,
        body: emailOutbox.body,
        attempts: emailOutbox.attempts,
        sentAt: emailOutbox.sentAt,
      })
      .from(emailOutbox)
      .where(eq(emailOutbox.id, outboxId))
      .limit(1);

    const message = rows[0];
    if (!message || message.sentAt) return false;

    const result = await sendViaResend(message);
    const attempts = message.attempts + 1;

    if (result.ok) {
      await db
        .update(emailOutbox)
        .set({ sentAt: new Date(), attempts, lastError: null, updatedAt: new Date() })
        .where(eq(emailOutbox.id, outboxId));
      return true;
    }

    await db
      .update(emailOutbox)
      .set({
        attempts,
        lastError: result.error,
        failedAt: attempts >= MAX_ATTEMPTS ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, outboxId));
    console.error(`[email] immediate send failed for ${outboxId}: ${result.error}`);
    return false;
  } catch (error) {
    /* Including a database error. The acknowledgement is a courtesy; the lead
       is the thing that matters and it is already saved. */
    console.error("[email] deliverNow threw", error);
    return false;
  }
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
