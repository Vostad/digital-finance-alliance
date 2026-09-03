/**
 * REQUEST → AUTHCONTEXT. The single entry point to identity in this system.
 *
 * Every server function starts here. Two facts are established before any
 * handler runs, in this order:
 *
 *   1. the token is genuine        — cryptographically verified, not decoded
 *   2. the account is still active — read from OUR users table, this request
 *
 * REQUIREMENT 3 lives in step 2. Deactivation must end access immediately, and
 * "immediately" cannot mean "when the token expires" — so the authoritative
 * answer is a row in the database, read on every single request, never a claim
 * baked into the token at login. The cost is one indexed primary-key lookup,
 * joined with the two small scope tables in the same round trip.
 *
 * REQUIREMENT 4 lives in the same read: role, functions, event scope and the
 * commission grants all come from that row. Nothing here consults a JWT claim
 * beyond `sub`, and `sub` is only used to find the row.
 */

import { eq } from "drizzle-orm";
import {
  deleteCookie,
  getCookie,
  getRequest,
  getRequestHeader,
  setCookie,
} from "@tanstack/react-start/server";

import { db } from "../db/client";
import { userEventScopes, userFunctions, users } from "../db/schema";
import type { AuthContext, Role, UserStatus, WorkFunction } from "./permissions";
import { authClient } from "./supabase.server";

export const ACCESS_TOKEN_COOKIE = "fr_at";
export const REFRESH_TOKEN_COOKIE = "fr_rt";

/** httpOnly, so an XSS on the admin surface cannot read the session and walk
    out with it. `secure` is off in development only because localhost is http. */
export const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env["NODE_ENV"] === "production",
  path: "/",
} as const;

/** Matched to the 5-minute access-token TTL with slack for clock skew. The
    refresh cookie is what keeps someone signed in across a working day. */
const ACCESS_MAX_AGE = 60 * 10;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export function writeSession(accessToken: string, refreshToken: string) {
  setCookie(ACCESS_TOKEN_COOKIE, accessToken, { ...COOKIE_BASE, maxAge: ACCESS_MAX_AGE });
  setCookie(REFRESH_TOKEN_COOKIE, refreshToken, { ...COOKIE_BASE, maxAge: REFRESH_MAX_AGE });
}

export function clearSession() {
  deleteCookie(ACCESS_TOKEN_COOKIE, COOKIE_BASE);
  deleteCookie(REFRESH_TOKEN_COOKIE, COOKIE_BASE);
}

export class AuthError extends Error {
  readonly statusCode: number;
  readonly code: "unauthenticated" | "deactivated" | "not_provisioned" | "forbidden";

  constructor(code: AuthError["code"], message: string, statusCode: number) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const unauthenticated = () => new AuthError("unauthenticated", "Sign in to continue.", 401);

/** Distinct from 401 on purpose: the credential was valid, the account is not.
    A deactivated person retrying with a fresh login must get the same answer,
    so the UI must not treat this as "your session expired". */
export const deactivated = () =>
  new AuthError("deactivated", "This account has been deactivated.", 403);

export const forbidden = (what = "You do not have access to this.") =>
  new AuthError("forbidden", what, 403);

function bearerToken(): string | undefined {
  const header = getRequestHeader("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return getCookie(ACCESS_TOKEN_COOKIE);
}

/**
 * Verify the token and return the Supabase user id.
 *
 * `getClaims` does real signature verification — asymmetric keys are checked
 * against the cached JWKS locally, symmetric ones against the auth server.
 * It is NOT `decodeJwt`: a decoded token is attacker-controlled JSON and
 * trusting it would make every rule below decorative.
 */
async function verifiedUserId(token: string): Promise<string | null> {
  const { data, error } = await authClient().auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return String(data.claims.sub);
}

/**
 * Trade the refresh token for a new access token.
 *
 * This is also where REQUIREMENT 3's second mechanism lands: a banned account's
 * refresh fails here, so once the 5-minute access token expires the session
 * cannot be extended and the person is signed out — even on a code path that
 * somehow skipped the status check below.
 */
async function refreshed(): Promise<string | null> {
  const refreshToken = getCookie(REFRESH_TOKEN_COOKIE);
  if (!refreshToken) return null;

  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    clearSession();
    return null;
  }

  writeSession(data.session.access_token, data.session.refresh_token);
  return data.session.access_token;
}

/**
 * Build the context for a KNOWN-GOOD Supabase user id.
 *
 * Split out from getAuthContext because sign-in cannot go through the request.
 * `setCookie` writes to the RESPONSE; `getCookie` reads the REQUEST. On the
 * login POST the request carries no session cookie, so a freshly written one is
 * invisible until the browser sends it back on the NEXT request — resolving the
 * context by re-reading the request would return null every time, for a
 * perfectly valid login. signIn passes the id from the session it just received
 * instead. Same checks, same failures, different way in.
 */
export async function loadContext(authUserId: string): Promise<AuthContext> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      status: users.status,
      timezone: users.timezone,
      canViewCommission: users.canViewCommission,
      canManageCommissionRules: users.canManageCommissionRules,
    })
    .from(users)
    .where(eq(users.id, authUserId))
    .limit(1);

  /** A verified Supabase account with no row here is not a user of this system.
      It happens if someone is created through the Supabase dashboard instead of
      the invite flow, and it must fail closed rather than default to any role. */
  if (!row) {
    throw new AuthError(
      "not_provisioned",
      "This account is not provisioned for Financial Rails OS.",
      403,
    );
  }

  if (row.status !== "active") throw deactivated();

  const [functions, scopes] = await Promise.all([
    db
      .select({ function: userFunctions.function })
      .from(userFunctions)
      .where(eq(userFunctions.userId, row.id)),
    db
      .select({ eventId: userEventScopes.eventId })
      .from(userEventScopes)
      .where(eq(userEventScopes.userId, row.id)),
  ]);

  return {
    userId: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role as Role,
    status: row.status as UserStatus,
    functions: functions.map((f) => f.function as WorkFunction),
    eventScopeIds: scopes.map((s) => s.eventId),
    canViewCommission: row.canViewCommission,
    canManageCommissionRules: row.canManageCommissionRules,
    timezone: row.timezone,
  };
}

/**
 * Resolve the caller from the incoming request. Returns null when there is no
 * usable session, and THROWS when there is a session belonging to an account
 * that may no longer act — the difference matters, because the first is "show
 * the login page" and the second is "say why".
 */
async function resolveAuthContext(): Promise<AuthContext | null> {
  const token = bearerToken();

  /** Verify what we have; if it has expired, refresh once and verify again.
      Never more than once — a second failure is a real failure. */
  let authUserId = token ? await verifiedUserId(token) : null;
  if (!authUserId) {
    const fresh = await refreshed();
    authUserId = fresh ? await verifiedUserId(fresh) : null;
  }
  if (!authUserId) return null;

  return loadContext(authUserId);
}

/**
 * REQUEST-SCOPED MEMOISATION — and the reasoning that makes it safe.
 *
 * Every server function calls requireAuth(), and resolving a context costs one
 * token verification plus three queries. During SSR, `beforeLoad` and `loader`
 * run inside a SINGLE server request, so a page that calls two server functions
 * paid for all of that twice. Measured: the dashboard did 6 auth queries where 3
 * would do.
 *
 * The key is the Request OBJECT ITSELF, not a user id, a token, or a string.
 * That single choice is what makes this safe rather than dangerous:
 *
 *   - it cannot cross requests   — a different request is a different object,
 *                                  so there is no key that could collide;
 *   - it cannot cross users      — two users are never in one request;
 *   - it cannot go stale         — the entry dies with the request, and a
 *                                  request is milliseconds long. There is no
 *                                  TTL to tune and nothing to invalidate;
 *   - it cannot leak memory      — a WeakMap entry is collected with its key.
 *
 * Deactivation, role changes and scope changes therefore take effect on the very
 * next request, exactly as before. This does not cache authorization; it
 * deduplicates identical work inside one request. §28 forbids the other thing.
 *
 * The promise is stored rather than the resolved value so that two concurrent
 * callers in the same request share one in-flight resolution instead of racing.
 *
 * Outside a request — integration tests, scripts — `getRequest()` throws and we
 * simply do not cache. Correctness never depends on the cache existing.
 */
const contextByRequest = new WeakMap<Request, Promise<AuthContext | null>>();

export async function getAuthContext(): Promise<AuthContext | null> {
  let request: Request | null = null;
  try {
    request = getRequest();
  } catch {
    /* No request scope. Resolve normally, cache nothing. */
  }
  if (!request) return resolveAuthContext();

  const inFlight = contextByRequest.get(request);
  if (inFlight) return inFlight;

  const pending = resolveAuthContext();
  contextByRequest.set(request, pending);
  return pending;
}

/** The form every server function uses. There is no unauthenticated data path
    into this system apart from the public website's form intake. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw unauthenticated();
  return ctx;
}
