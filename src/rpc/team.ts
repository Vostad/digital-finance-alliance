/**
 * THE RPC SURFACE for team management — and nothing else.
 *
 * Thin wrappers, exactly like src/rpc/auth.ts: validate, call the domain
 * function, return a plain object. Every authorization decision is made inside
 * `src/server/auth/accounts.ts`, on the server, where it cannot be reached by
 * hiding a button. These handlers add no checks of their own, because a second
 * place that decides who may create a user is a second place to get it wrong.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AuthError, requireAuth } from "@/server/auth/context";
import {
  createUser,
  listEventsForScope,
  listTeam,
  setUserEventScopes,
  setUserFunctions,
  setUserRole,
} from "@/server/auth/accounts";

async function sealed<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (problem) {
    if (problem instanceof AuthError) throw problem;
    if (problem != null && typeof problem === "object" && "statusCode" in problem) throw problem;
    console.error("[rpc/team]", problem);
    throw new AuthError("unauthenticated", "Something went wrong. Try again.", 500);
  }
}

const ROLE = z.enum(["super_admin", "admin", "team_member"]);
const FUNCTION = z.enum(["sponsor", "delegate", "speaker"]);

export const roster = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => {
    const ctx = await requireAuth();
    return {
      rows: await listTeam(ctx),
      /* Carried so the screen knows which controls to offer. It decides what to
         RENDER; the server still decides what is ALLOWED. */
      user: { userId: ctx.userId, fullName: ctx.fullName, role: ctx.role },
    };
  }),
);

export const scopeEvents = createServerFn({ method: "GET" }).handler(() =>
  sealed(async () => listEventsForScope(await requireAuth())),
);

export const addUser = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email().max(320),
      fullName: z.string().min(1).max(160),
      /* Long enough that a hurried Super Admin cannot set something guessable.
         Supabase enforces its own project minimum on top of this. */
      password: z.string().min(12).max(200),
      role: ROLE,
      functions: z.array(FUNCTION).max(3),
      eventIds: z.array(z.string().uuid()).max(50),
    }),
  )
  .handler(({ data }) => sealed(async () => createUser(data, await requireAuth())));

export const changeRole = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid(), role: ROLE }))
  .handler(({ data }) => sealed(async () => setUserRole(data, await requireAuth())));

export const changeFunctions = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid(), functions: z.array(FUNCTION).max(3) }))
  .handler(({ data }) => sealed(async () => setUserFunctions(data, await requireAuth())));

export const changeEventScopes = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid(), eventIds: z.array(z.string().uuid()).max(50) }))
  .handler(({ data }) => sealed(async () => setUserEventScopes(data, await requireAuth())));
