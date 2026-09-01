/**
 * THE PUBLIC INTAKE ENDPOINT — §6.
 *
 * The one server function in the system with NO `requireAuth()`. It is reached
 * by anyone who loads /forums/mena, so it builds its own context: a synthetic
 * system actor with no user id, and an unscoped query, because there is no
 * session to scope by.
 *
 * That synthetic actor is `super_admin` in shape only, and it never touches
 * anything a visitor could steer: the domain call it makes creates exactly one
 * person and one workstream from validated input, with `ownerId: null`. It
 * cannot read, list, or reach any other record.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { scopedQuery } from "@/server/auth/scoped";
import type { AuthContext } from "@/server/auth/permissions";
import { RateLimited, SpamRejected, receiveWebsiteLead } from "@/server/domain/intake";
import { ValidationError } from "@/server/domain/opportunities";

/**
 * Hashed, never stored raw. A rate limit needs to recognise a repeat visitor;
 * it does not need to know who they are, and an IP in a table is personal data
 * we would then owe §31 an answer about.
 */
function hashedIp(): string | null {
  const ip = getRequestIP({ xForwardedFor: true });
  if (!ip) return null;
  return createHash("sha256").update(`fr-os:${ip}`).digest("hex").slice(0, 32);
}

/** No user. Present so the domain layer has a uniform shape to work with. */
const SYSTEM_ACTOR: AuthContext = {
  userId: "00000000-0000-4000-8000-000000000000",
  email: "system@financialrails.org",
  fullName: "Website",
  role: "super_admin",
  status: "active",
  functions: ["sponsor", "delegate", "speaker"],
  eventScopeIds: [],
  canViewCommission: false,
  canManageCommissionRules: false,
  timezone: "UTC",
};

export const submitWebsiteLead = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kind: z.enum(["prospectus", "apply"]),
      name: z.string().min(1).max(200),
      email: z.string().min(3).max(320),
      company: z.string().max(200).default(""),
      role: z.string().max(200).optional(),
      notes: z.string().max(2000).optional(),
      honeypot: z.string().max(200).optional(),
      elapsedMs: z.number().int().min(0).max(86_400_000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const q = scopedQuery(SYSTEM_ACTOR);

    try {
      const result = await receiveWebsiteLead(
        q,
        {
          ...data,
          ipHash: hashedIp(),
          userAgent: getRequestHeader("user-agent") ?? null,
        },
        /* createdBy is null for a website submission: no user acted, and
           pretending one did would be worse than the gap. */
        { ...SYSTEM_ACTOR, userId: null as unknown as string },
      );
      return { ok: true as const, submissionId: result.submissionId };
    } catch (error) {
      /* A bot gets the same answer a person does. Telling it that it was
         detected only teaches whoever wrote it what to change. */
      if (error instanceof SpamRejected) return { ok: true as const, submissionId: null };
      if (error instanceof RateLimited || error instanceof ValidationError) throw error;

      console.error("[rpc/intake]", error);
      throw new ValidationError("We could not record that. Please try again.");
    }
  });
