import type { AuthContext, OpportunitySubject, Role } from "../auth/permissions";

export const EVENT_MENA = "11111111-1111-4111-8111-111111111111";
export const EVENT_ASIA = "22222222-2222-4222-8222-222222222222";

export const SUPER = "aaaaaaaa-0000-4000-8000-000000000001";
export const ADMIN = "aaaaaaaa-0000-4000-8000-000000000002";
export const MEMBER = "aaaaaaaa-0000-4000-8000-000000000003";
export const OTHER_MEMBER = "aaaaaaaa-0000-4000-8000-000000000004";

export function ctx(role: Role, overrides: Partial<AuthContext> = {}): AuthContext {
  const base: AuthContext = {
    userId: role === "super_admin" ? SUPER : role === "admin" ? ADMIN : MEMBER,
    email: `${role}@example.test`,
    fullName: role,
    role,
    status: "active",
    functions: ["sponsor"],
    eventScopeIds: role === "admin" ? [EVENT_MENA] : [],
    canViewCommission: false,
    canManageCommissionRules: false,
    timezone: "Asia/Dubai",
  };
  return { ...base, ...overrides };
}

export function opp(overrides: Partial<OpportunitySubject> = {}): OpportunitySubject {
  return {
    ownerId: MEMBER,
    secondaryOwnerId: null,
    eventId: EVENT_MENA,
    function: "sponsor",
    ...overrides,
  };
}
