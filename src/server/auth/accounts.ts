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
import { asc, eq, inArray } from "drizzle-orm";

import { db } from "../db/client";
import { events, userEventScopes, userFunctions, users } from "../db/schema";
import { recordAudit } from "../domain/audit";
import type { AuthContext, Role, WorkFunction } from "./permissions";
import {
  AuthError,
  clearSession,
  getAuthContext,
  loadContext,
  REFRESH_TOKEN_COOKIE,
  requireAuth,
  writeSession,
} from "./context";
import { canManageUsers } from "./permissions";
import {
  authClient,
  createAuthUser,
  deleteAuthUser,
  restoreUserSessions,
  revokeUserSessions,
} from "./supabase.server";

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
      rejected here rather than on the first screen they reach.

      From the session id, NOT from the request: the cookie written a line ago
      is on the RESPONSE, and the browser has not sent it back yet — reading the
      request would return null for a perfectly valid login. This id came from
      the auth server over TLS moments ago. */
  try {
    const ctx = await loadContext(session.session.user.id);
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

/* ------------------------------------------------------------------- team */

/**
 * TEAM MANAGEMENT — the minimum privileged write path, and nothing more.
 *
 * Four operations: create a person, say what they are, say what work they do,
 * say which events they may see. There is no permission builder, no hierarchy,
 * no profile. The role and function vocabularies are database enums with three
 * values each; this module never invents a fourth.
 *
 * Every function below starts with the same two lines — Super Admin, and not
 * yourself. `canManageUsers` is already Super-Admin-only and is reused rather
 * than replaced, because a second permission model is exactly how the first one
 * stops being the truth.
 *
 * "Not yourself" is not politeness. A Super Admin who demotes or deactivates
 * their own account can lock every remaining person out of user management, and
 * there is no recovery path inside the product.
 */

const ROLES: Role[] = ["super_admin", "admin", "team_member"];
const FUNCTIONS: WorkFunction[] = ["sponsor", "delegate", "speaker"];

function assertManagesUsers(ctx: AuthContext, targetUserId?: string) {
  if (!canManageUsers(ctx)) {
    throw new AuthError("forbidden", "Only a Super Admin can manage team accounts.", 403);
  }
  if (targetUserId && targetUserId === ctx.userId) {
    throw new AuthError("forbidden", "You cannot change your own account here.", 403);
  }
}

/** Reject anything outside the enum before it reaches the database. Postgres
    would reject it too, but as a 500 rather than as an answer. */
function assertRole(role: string): asserts role is Role {
  if (!ROLES.includes(role as Role)) {
    throw new AuthError("forbidden", "That is not a role in this system.", 403);
  }
}

function assertFunctions(fns: string[]): asserts fns is WorkFunction[] {
  for (const f of fns) {
    if (!FUNCTIONS.includes(f as WorkFunction)) {
      throw new AuthError("forbidden", "That is not a work function in this system.", 403);
    }
  }
}

/**
 * Create a colleague's account.
 *
 * Two systems, no shared transaction, so the order is chosen to fail safe:
 * Supabase Auth first (it is the foreign key target and the part that can fail
 * on the network), then our row inside a transaction with its audit entry. If
 * the second half fails we delete the auth account, because an auth user with
 * no application row can sign in and resolve to nothing.
 *
 * That state is already handled — `loadContext` throws `not_provisioned` rather
 * than defaulting to a role — so this cleanup is about tidiness, not safety. The
 * safety was there first.
 */
export async function createUser(
  input: {
    email: string;
    fullName: string;
    password: string;
    role: Role;
    functions: WorkFunction[];
    eventIds: string[];
  },
  ctx: AuthContext,
) {
  assertManagesUsers(ctx);
  assertRole(input.role);
  assertFunctions(input.functions);

  const email = input.email.trim().toLowerCase();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length) {
    throw new AuthError("forbidden", "Someone with that email already exists.", 403);
  }

  await assertEventsExist(input.eventIds);

  const authUserId = await createAuthUser(email, input.password);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: authUserId,
        email,
        fullName: input.fullName.trim(),
        role: input.role,
        /* Active immediately: a Super Admin setting the first password IS the
           provisioning step. `invited` exists for a flow this product does not
           have, and leaving them there would simply lock them out. */
        status: "active",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      if (input.functions.length) {
        await tx
          .insert(userFunctions)
          .values(input.functions.map((f) => ({ userId: authUserId, function: f })));
      }
      if (input.eventIds.length) {
        await tx
          .insert(userEventScopes)
          .values(input.eventIds.map((eventId) => ({ userId: authUserId, eventId })));
      }

      await recordAudit(tx as never, {
        ctx,
        entityType: "user",
        entityId: authUserId,
        action: "created",
        after: {
          email,
          role: input.role,
          functions: input.functions,
          eventIds: input.eventIds,
        },
      });
    });
  } catch (problem) {
    await deleteAuthUser(authUserId).catch(() => undefined);
    throw problem;
  }

  return { userId: authUserId, email };
}

async function assertEventsExist(eventIds: string[]) {
  if (!eventIds.length) return;
  const found = await db.select({ id: events.id }).from(events).where(inArray(events.id, eventIds));
  if (found.length !== eventIds.length) {
    throw new AuthError("forbidden", "That event does not exist.", 403);
  }
}

export async function setUserRole(input: { userId: string; role: Role }, ctx: AuthContext) {
  assertManagesUsers(ctx, input.userId);
  assertRole(input.role);

  const [before] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!before) throw new AuthError("forbidden", "No such account.", 403);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ role: input.role, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(eq(users.id, input.userId));
    await recordAudit(tx as never, {
      ctx,
      entityType: "user",
      entityId: input.userId,
      action: "role_changed",
      before: { role: before.role },
      after: { role: input.role },
    });
  });

  return { userId: input.userId, role: input.role };
}

/** Replace the set. Sending the whole set rather than add/remove deltas keeps
    the screen and the database describing the same thing at all times. */
export async function setUserFunctions(
  input: { userId: string; functions: WorkFunction[] },
  ctx: AuthContext,
) {
  assertManagesUsers(ctx, input.userId);
  assertFunctions(input.functions);

  const before = await db
    .select({ function: userFunctions.function })
    .from(userFunctions)
    .where(eq(userFunctions.userId, input.userId));

  await db.transaction(async (tx) => {
    await tx.delete(userFunctions).where(eq(userFunctions.userId, input.userId));
    if (input.functions.length) {
      await tx
        .insert(userFunctions)
        .values(input.functions.map((f) => ({ userId: input.userId, function: f })));
    }
    await recordAudit(tx as never, {
      ctx,
      entityType: "user",
      entityId: input.userId,
      action: "updated",
      before: { functions: before.map((f) => f.function) },
      after: { functions: input.functions },
    });
  });

  return { userId: input.userId, functions: input.functions };
}

export async function setUserEventScopes(
  input: { userId: string; eventIds: string[] },
  ctx: AuthContext,
) {
  assertManagesUsers(ctx, input.userId);
  await assertEventsExist(input.eventIds);

  const before = await db
    .select({ eventId: userEventScopes.eventId })
    .from(userEventScopes)
    .where(eq(userEventScopes.userId, input.userId));

  await db.transaction(async (tx) => {
    await tx.delete(userEventScopes).where(eq(userEventScopes.userId, input.userId));
    if (input.eventIds.length) {
      await tx
        .insert(userEventScopes)
        .values(input.eventIds.map((eventId) => ({ userId: input.userId, eventId })));
    }
    await recordAudit(tx as never, {
      ctx,
      entityType: "user",
      entityId: input.userId,
      action: "updated",
      before: { eventIds: before.map((s) => s.eventId) },
      after: { eventIds: input.eventIds },
    });
  });

  return { userId: input.userId, eventIds: input.eventIds };
}

/**
 * The roster behind the Team screen.
 *
 * Readable by any manager, because "who is working what" is the question the
 * screen exists to answer and an Admin needs it to assign work. It carries no
 * commission figures and no personal data beyond a name and a work email.
 */
export async function listTeam(ctx: AuthContext) {
  if (ctx.role === "team_member") {
    throw new AuthError("forbidden", "You do not have access to this.", 403);
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .orderBy(asc(users.fullName));

  const [fns, scopes] = await Promise.all([
    db
      .select({ userId: userFunctions.userId, function: userFunctions.function })
      .from(userFunctions),
    db
      .select({ userId: userEventScopes.userId, eventId: userEventScopes.eventId })
      .from(userEventScopes),
  ]);

  return rows.map((r) => ({
    ...r,
    functions: fns.filter((f) => f.userId === r.id).map((f) => f.function),
    eventIds: scopes.filter((s) => s.userId === r.id).map((s) => s.eventId),
  }));
}

/** Events a Super Admin may grant scope over. Also drives the Events screen's
    picker, so it lives here rather than being duplicated. */
export async function listEventsForScope(ctx: AuthContext) {
  if (ctx.role === "team_member") {
    throw new AuthError("forbidden", "You do not have access to this.", 403);
  }
  return db.select({ id: events.id, name: events.name }).from(events).orderBy(asc(events.name));
}
