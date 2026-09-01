/**
 * THE SESSION — sign in, sign out, and the one deactivation path.
 *
 * Plain async functions, not server functions. The RPC surface that calls them
 * lives in src/rpc/auth.ts: TanStack Start refuses any client import reaching
 * into src/server/**, and it is right to — this module pulls in the Postgres
 * driver and the service-role client, neither of which may be within reach of
 * a bundler walking the route tree.
 *
 * Tokens live in httpOnly cookies, never in localStorage: an XSS on the admin
 * surface should not be able to read the session and walk out with it.
 *
 * REQUIREMENT 3, in full, is spread across three mechanisms and all three are
 * needed — none of them is sufficient alone:
 *
 *   users.status        checked on EVERY request in context.ts   → 0 seconds
 *   ban (auth)          refresh fails, so the session cannot be extended
 *   5-minute token TTL  bounds the stateless-JWT window if the first is ever
 *                       bypassed by a code path that forgets to resolve ctx
 *
 * The TTL is a Supabase project setting, not code — see docs/fr-os/supabase-setup.md.
 */

import { getCookie } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";

import { db } from "../db/client";
import { users } from "../db/schema";
import {
  AuthError,
  clearSession,
  getAuthContext,
  REFRESH_TOKEN_COOKIE,
  requireAuth,
  writeSession,
} from "./context";
import { canManageUsers } from "./permissions";
import { authClient, restoreUserSessions, revokeUserSessions } from "./supabase.server";

export async function signIn(data: { email: string; password: string }) {
  const { data: session, error } = await authClient().auth.signInWithPassword({
    email: data.email.trim().toLowerCase(),
    password: data.password,
  });

  /** One message for every failure. Distinguishing "no such account" from
        "wrong password" tells an attacker which emails are worth attacking. */
  if (error || !session.session) {
    throw new AuthError("unauthenticated", "Email or password is incorrect.", 401);
  }

  writeSession(session.session.access_token, session.session.refresh_token);

  /** Resolve immediately, so a deactivated or unprovisioned account is
        rejected here rather than on the first screen they reach. */
  try {
    const ctx = await getAuthContext();
    if (!ctx) throw new AuthError("unauthenticated", "Email or password is incorrect.", 401);
    return { fullName: ctx.fullName, role: ctx.role };
  } catch (problem) {
    clearSession();
    throw problem;
  }
}

export async function signOut() {
  const refreshToken = getCookie(REFRESH_TOKEN_COOKIE);
  clearSession();
  /** Best effort: the cookies are already gone, so a failure here cannot leave
      the browser signed in. It only means one refresh token outlives its use. */
  if (refreshToken) {
    await authClient()
      .auth.signOut()
      .catch(() => undefined);
  }
  return { ok: true };
}

/** Whoever is signed in, or null. The only thing the login page needs. */
export async function currentUser() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return null;
    return {
      userId: ctx.userId,
      email: ctx.email,
      fullName: ctx.fullName,
      role: ctx.role,
      functions: ctx.functions,
      eventScopeIds: ctx.eventScopeIds,
      canViewCommission: ctx.canViewCommission,
      timezone: ctx.timezone,
    };
  } catch (problem) {
    /** A deactivated session must not leave a stale cookie behind to retry. */
    if (problem instanceof AuthError) clearSession();
    throw problem;
  }
}

/**
 * REQUIREMENT 3 — the write path. Domain status first, because that is what
 * every subsequent request reads; token revocation second, because it is the
 * part that can fail on the network and must not leave the account marked
 * active if it does.
 */
export async function setUserActive(data: { userId: string; active: boolean }) {
  const ctx = await requireAuth();
  if (!canManageUsers(ctx)) {
    throw new AuthError("forbidden", "Only a Super Admin can change account access.", 403);
  }
  if (data.userId === ctx.userId) {
    throw new AuthError("forbidden", "You cannot deactivate your own account.", 403);
  }

  await db
    .update(users)
    .set({
      status: data.active ? "active" : "deactivated",
      deactivatedAt: data.active ? null : new Date(),
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    })
    .where(eq(users.id, data.userId));

  if (data.active) await restoreUserSessions(data.userId);
  else await revokeUserSessions(data.userId);

  return { userId: data.userId, active: data.active };
}
