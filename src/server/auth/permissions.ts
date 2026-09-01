/**
 * THE PERMISSION MODEL, as pure functions.
 *
 * Deliberately free of database, request and framework: every rule in this file
 * is a total function of (context, subject). That is what makes the Gate 2 test
 * suite meaningful — the rules are proved directly, not inferred from whether a
 * query happened to return rows.
 *
 * REQUIREMENT 4 — role, functions, event scope and the commission grants are
 * DOMAIN DATA. They arrive here from the `users` table read on this request.
 * Nothing in this file reads a JWT claim, and nothing may start to: a claim is
 * minted at login and cached in the token, so a revoked grant would keep
 * working until the token expired.
 */

export type Role = "super_admin" | "admin" | "team_member";
export type UserStatus = "invited" | "active" | "deactivated";
export type WorkFunction = "sponsor" | "delegate" | "speaker";

export type AuthContext = {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  functions: readonly WorkFunction[];
  /** Empty for super_admin — they are not scoped, and an empty list must never
      be read as "no access" for that role. Checked by role first, always. */
  eventScopeIds: readonly string[];
  canViewCommission: boolean;
  canManageCommissionRules: boolean;
  timezone: string;
};

/** The minimum an opportunity must expose for a decision to be made about it. */
export type OpportunitySubject = {
  ownerId: string | null;
  secondaryOwnerId: string | null;
  eventId: string;
  function: WorkFunction;
};

export type UserSubject = {
  id: string;
  role: Role;
};

const isSuper = (ctx: AuthContext) => ctx.role === "super_admin";
const isAdmin = (ctx: AuthContext) => ctx.role === "admin";

/* ---------------------------------------------------------------- event scope */

/** Super Admin is unscoped. Admin is scoped to explicitly granted events only —
    never inferred from a deal they happen to have touched. Team Members do not
    hold event scope at all; their reach is their own work, checked below. */
export function canAccessEvent(ctx: AuthContext, eventId: string): boolean {
  if (isSuper(ctx)) return true;
  if (isAdmin(ctx)) return ctx.eventScopeIds.includes(eventId);
  return false;
}

/* ---------------------------------------------------------- opportunity reach */

export function ownsOpportunity(ctx: AuthContext, opp: OpportunitySubject): boolean {
  return opp.ownerId === ctx.userId || opp.secondaryOwnerId === ctx.userId;
}

export function canReadOpportunity(ctx: AuthContext, opp: OpportunitySubject): boolean {
  if (isSuper(ctx)) return true;
  if (isAdmin(ctx)) return canAccessEvent(ctx, opp.eventId);
  return ownsOpportunity(ctx, opp);
}

/**
 * Write is not read. A Team Member may work their own opportunities; an
 * unassigned one is nobody's to edit — it sits in the Super Admin inbox until
 * it is assigned, which is the whole point of `owner_id IS NULL` being a real
 * state rather than a placeholder.
 */
export function canWriteOpportunity(ctx: AuthContext, opp: OpportunitySubject): boolean {
  if (isSuper(ctx)) return true;
  if (isAdmin(ctx)) return canAccessEvent(ctx, opp.eventId);
  return ownsOpportunity(ctx, opp);
}

/** Reassignment is a management act, never a self-service one: a Team Member
    cannot hand their own pipeline away, nor claim someone else's. */
export function canAssignOpportunity(ctx: AuthContext, opp: OpportunitySubject): boolean {
  if (isSuper(ctx)) return true;
  if (isAdmin(ctx)) return canAccessEvent(ctx, opp.eventId);
  return false;
}

export function canLogActivity(ctx: AuthContext, opp: OpportunitySubject): boolean {
  return canWriteOpportunity(ctx, opp);
}

/* -------------------------------------------------------------- commission */

/** Everyone may see their own. Beyond that it is an explicit grant, off by
    default, and Admin having the grant does not make it inheritable. */
export function canViewCommissionFor(ctx: AuthContext, targetUserId: string): boolean {
  if (targetUserId === ctx.userId) return true;
  if (isSuper(ctx)) return true;
  if (isAdmin(ctx)) return ctx.canViewCommission;
  return false;
}

export function canManageCommissionRules(ctx: AuthContext): boolean {
  if (isSuper(ctx)) return true;
  return isAdmin(ctx) && ctx.canManageCommissionRules;
}

/* ------------------------------------------------------------- user records */

/** The projection every role may resolve: enough to render "owned by", never
    more. Names appear all over the UI; nothing else has to. */
export const USER_PUBLIC_FIELDS = ["id", "fullName"] as const;
export type UserPublicField = (typeof USER_PUBLIC_FIELDS)[number];

export const USER_FULL_FIELDS = [
  "id",
  "fullName",
  "email",
  "role",
  "status",
  "timezone",
  "canViewCommission",
  "canManageCommissionRules",
  "createdAt",
  "deactivatedAt",
] as const;
export type UserFullField = (typeof USER_FULL_FIELDS)[number];

/**
 * APPROVED AT GATE 2 — an Admin must be able to resolve `id` and `full_name`
 * for ANY user, Super Admin included, because a Super Admin can own an
 * opportunity and an unresolvable owner renders as a blank cell. Everything
 * else on a Super Admin record stays closed to them.
 */
export function visibleUserFields(
  ctx: AuthContext,
  target: UserSubject,
): readonly (UserPublicField | UserFullField)[] {
  if (isSuper(ctx)) return USER_FULL_FIELDS;
  if (target.id === ctx.userId) return USER_FULL_FIELDS;
  if (isAdmin(ctx)) {
    return target.role === "super_admin" ? USER_PUBLIC_FIELDS : USER_FULL_FIELDS;
  }
  return USER_PUBLIC_FIELDS;
}

/** Account lifecycle — invite, deactivate, change role — is Super Admin only.
    An Admin who could mint Admins is a Super Admin with extra steps. */
export function canManageUsers(ctx: AuthContext): boolean {
  return isSuper(ctx);
}

export function canManageEvents(ctx: AuthContext): boolean {
  return isSuper(ctx);
}

/** §4 — a merge rewrites history across every table that referenced the loser. */
export function canMergeRecords(ctx: AuthContext): boolean {
  return isSuper(ctx) || isAdmin(ctx);
}

/** §39 — irreversible, and the only operation in the system that destroys data. */
export function canErasePerson(ctx: AuthContext): boolean {
  return isSuper(ctx);
}

/** The unassigned inbox. Defined as a role capability so no screen has to
    reimplement `owner_id IS NULL` and get it subtly wrong. */
export function canViewUnassignedInbox(ctx: AuthContext): boolean {
  return isSuper(ctx) || isAdmin(ctx);
}
