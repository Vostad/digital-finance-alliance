/**
 * The two Supabase clients, kept apart on purpose.
 *
 * `authClient`  — anon key. Verifies tokens and performs password sign-in.
 * `adminClient` — SERVICE ROLE key. Creates and revokes accounts. Bypasses RLS.
 *
 * REQUIREMENT 2. The admin client exists in exactly one module so there is one
 * place to audit. Nothing here is reachable from the browser: `serverEnv` reads
 * un-prefixed variables Vite cannot inline, and `npm run check:client-bundle`
 * fails the build if either the variable name or the key value appears in
 * client output.
 */

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "../env.server";

/** No session persistence anywhere on the server — a module-level client is
    shared by every concurrent request, and a persisted session would leak one
    user's identity into another user's request. */
const serverClientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

let auth: ReturnType<typeof createClient> | undefined;
let admin: ReturnType<typeof createClient> | undefined;

export function authClient() {
  auth ??= createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, serverClientOptions);
  return auth;
}

export function adminClient() {
  admin ??= createClient(
    serverEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    serverClientOptions,
  );
  return admin;
}

/**
 * REQUIREMENT 3, the auth half. Banning revokes the refresh token, so the
 * session cannot be extended. The access token already issued is a stateless
 * JWT and stays syntactically valid until it expires — which is why the
 * domain half (users.status) is checked on every request in context.ts, and
 * why the access-token TTL is lowered to 5 minutes.
 */
export async function revokeUserSessions(authUserId: string) {
  const { error } = await adminClient().auth.admin.updateUserById(authUserId, {
    ban_duration: "876000h", // 100 years. Supabase has no "forever" literal.
  });
  if (error) throw error;
}

export async function restoreUserSessions(authUserId: string) {
  const { error } = await adminClient().auth.admin.updateUserById(authUserId, {
    ban_duration: "none",
  });
  if (error) throw error;
}

/**
 * Create the Supabase Auth account that a `public.users` row must point at.
 *
 * `public.users.id` is a foreign key onto `auth.users(id)` with ON DELETE
 * RESTRICT, so the order is forced: the auth account first, then our row. There
 * is no way to provision a user the other way round, and nothing here invents a
 * second place where accounts come from.
 *
 * `email_confirm: true` because a Super Admin creating a colleague's account IS
 * the verification — there is no self-service signup in this system to confirm.
 */
export async function createAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error("Supabase returned no user id");
  return id;
}

/**
 * Remove an auth account.
 *
 * Used for exactly one purpose: undoing a half-finished creation. If the auth
 * account exists but our row could not be written, the account can sign in and
 * resolve to nothing — `loadContext` fails it closed as `not_provisioned`, so
 * it is safe, but it is litter that would accumulate and confuse the next
 * person reading the user list. Deleting it is how creation stays all-or-nothing
 * across two systems that have no shared transaction.
 */
export async function deleteAuthUser(authUserId: string): Promise<void> {
  const { error } = await adminClient().auth.admin.deleteUser(authUserId);
  if (error) throw error;
}
