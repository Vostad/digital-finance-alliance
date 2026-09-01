/**
 * THE RPC SURFACE for authentication — and nothing else.
 *
 * Every function here is a thin wrapper: validate the input, call the domain
 * function in src/server/auth, return a plain object. The logic is not
 * duplicated here and must not start to be.
 *
 * Why the split exists: TanStack Start denies any client-reachable import of
 * `src/server/**`, because that tree pulls in the Postgres driver and the
 * service-role Supabase client. Route components import THIS file; the compiler
 * strips the handler bodies out of the client build and leaves an RPC call, so
 * nothing under src/server ever reaches the browser bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AuthError } from "@/server/auth/context";
import { currentUser, setUserActive, signIn, signOut } from "@/server/auth/accounts";

/**
 * Only deliberate messages cross the wire.
 *
 * An AuthError says something we chose to say — "Email or password is
 * incorrect", "This account has been deactivated". Anything else is an internal
 * failure, and its message is written for us, not for the person signing in: a
 * missing environment variable, a driver error, a connection string. Those get
 * logged in full and replaced with one sentence.
 */
async function sealed<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (problem) {
    if (problem instanceof AuthError) throw problem;
    if (problem != null && typeof problem === "object" && "statusCode" in problem) throw problem;
    console.error("[rpc/auth]", problem);
    throw new AuthError("unauthenticated", "Something went wrong. Try again.", 500);
  }
}

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(200) }))
  .handler(({ data }) => sealed(() => signIn(data)));

export const logout = createServerFn({ method: "POST" }).handler(() => sealed(() => signOut()));

export const me = createServerFn({ method: "GET" }).handler(() => sealed(() => currentUser()));

/** REQUIREMENT 3 — the only way an account is switched off, and Super Admin
    only. The authorization check is inside setUserActive, on the server, where
    it cannot be skipped by calling this endpoint directly. */
export const setAccountActive = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid(), active: z.boolean() }))
  .handler(({ data }) => sealed(() => setUserActive(data)));
