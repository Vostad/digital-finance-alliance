/**
 * THE PERMISSION MATRIX.
 *
 * One assertion per rule, stated as the sentence it is meant to enforce. If a
 * rule is ever loosened, the test that fails names the guarantee that was lost.
 */

import { describe, expect, it } from "vitest";

import {
  canAccessEvent,
  canAssignOpportunity,
  canErasePerson,
  canManageCommissionRules,
  canManageUsers,
  canReadOpportunity,
  canViewCommissionFor,
  canViewUnassignedInbox,
  canWriteOpportunity,
  USER_FULL_FIELDS,
  USER_PUBLIC_FIELDS,
  visibleUserFields,
} from "../auth/permissions";
import { ADMIN, ctx, EVENT_ASIA, EVENT_MENA, MEMBER, opp, OTHER_MEMBER, SUPER } from "./factories";

describe("event scope", () => {
  it("Super Admin is unscoped and holds no scope rows", () => {
    const c = ctx("super_admin");
    expect(c.eventScopeIds).toHaveLength(0);
    expect(canAccessEvent(c, EVENT_MENA)).toBe(true);
    expect(canAccessEvent(c, EVENT_ASIA)).toBe(true);
  });

  it("Admin reaches only explicitly granted events", () => {
    const c = ctx("admin");
    expect(canAccessEvent(c, EVENT_MENA)).toBe(true);
    expect(canAccessEvent(c, EVENT_ASIA)).toBe(false);
  });

  it("an Admin with no grants reaches nothing — empty is not a wildcard", () => {
    expect(canAccessEvent(ctx("admin", { eventScopeIds: [] }), EVENT_MENA)).toBe(false);
  });

  it("Team Members hold no event scope at all", () => {
    expect(canAccessEvent(ctx("team_member"), EVENT_MENA)).toBe(false);
  });
});

describe("opportunity visibility", () => {
  it("a Team Member sees the deals they own", () => {
    expect(canReadOpportunity(ctx("team_member"), opp({ ownerId: MEMBER }))).toBe(true);
  });

  it("a Team Member sees deals they co-own", () => {
    const shared = opp({ ownerId: OTHER_MEMBER, secondaryOwnerId: MEMBER });
    expect(canReadOpportunity(ctx("team_member"), shared)).toBe(true);
  });

  it("a Team Member cannot see a colleague's deal", () => {
    const theirs = opp({ ownerId: OTHER_MEMBER, secondaryOwnerId: null });
    expect(canReadOpportunity(ctx("team_member"), theirs)).toBe(false);
    expect(canWriteOpportunity(ctx("team_member"), theirs)).toBe(false);
  });

  it("a Team Member cannot claim an unassigned lead", () => {
    const unassigned = opp({ ownerId: null, secondaryOwnerId: null });
    expect(canReadOpportunity(ctx("team_member"), unassigned)).toBe(false);
    expect(canWriteOpportunity(ctx("team_member"), unassigned)).toBe(false);
    expect(canAssignOpportunity(ctx("team_member"), unassigned)).toBe(false);
  });

  it("an Admin sees every deal in their events and none outside them", () => {
    const c = ctx("admin");
    expect(canReadOpportunity(c, opp({ eventId: EVENT_MENA, ownerId: OTHER_MEMBER }))).toBe(true);
    expect(canReadOpportunity(c, opp({ eventId: EVENT_ASIA, ownerId: OTHER_MEMBER }))).toBe(false);
    expect(canWriteOpportunity(c, opp({ eventId: EVENT_ASIA }))).toBe(false);
  });

  it("an unassigned lead is visible to an Admin in scope but writable by nobody below Super Admin", () => {
    const unassigned = opp({ ownerId: null, secondaryOwnerId: null, eventId: EVENT_MENA });
    expect(canReadOpportunity(ctx("admin"), unassigned)).toBe(true);
    expect(canAssignOpportunity(ctx("admin"), unassigned)).toBe(true);
    expect(canAssignOpportunity(ctx("team_member"), unassigned)).toBe(false);
  });

  it("Super Admin sees everything, including deals outside every scope", () => {
    const c = ctx("super_admin");
    expect(canReadOpportunity(c, opp({ eventId: EVENT_ASIA, ownerId: OTHER_MEMBER }))).toBe(true);
    expect(canWriteOpportunity(c, opp({ eventId: EVENT_ASIA, ownerId: null }))).toBe(true);
  });

  it("reassignment is never self-service", () => {
    expect(canAssignOpportunity(ctx("team_member"), opp({ ownerId: MEMBER }))).toBe(false);
  });
});

describe("commission", () => {
  it("everyone sees their own ledger", () => {
    expect(canViewCommissionFor(ctx("team_member"), MEMBER)).toBe(true);
    expect(canViewCommissionFor(ctx("admin"), ADMIN)).toBe(true);
  });

  it("a Team Member never sees another person's ledger", () => {
    expect(canViewCommissionFor(ctx("team_member"), OTHER_MEMBER)).toBe(false);
  });

  it("an Admin without the grant sees only their own", () => {
    expect(canViewCommissionFor(ctx("admin"), MEMBER)).toBe(false);
  });

  it("the grant is what opens it, and it is off by default", () => {
    expect(ctx("admin").canViewCommission).toBe(false);
    expect(canViewCommissionFor(ctx("admin", { canViewCommission: true }), MEMBER)).toBe(true);
  });

  it("editing rules is a separate grant from reading amounts", () => {
    const viewer = ctx("admin", { canViewCommission: true });
    expect(canManageCommissionRules(viewer)).toBe(false);

    const editor = ctx("admin", { canManageCommissionRules: true });
    expect(canManageCommissionRules(editor)).toBe(true);
    expect(canViewCommissionFor(editor, MEMBER)).toBe(false);
  });

  it("a Team Member can never manage rules, grant or no grant", () => {
    expect(canManageCommissionRules(ctx("team_member", { canManageCommissionRules: true }))).toBe(
      false,
    );
  });
});

describe("user records — the Gate 2 ruling", () => {
  it("an Admin can resolve id and full_name for a Super Admin, and nothing else", () => {
    const fields = visibleUserFields(ctx("admin"), { id: SUPER, role: "super_admin" });
    expect(fields).toEqual(USER_PUBLIC_FIELDS);
    expect(fields).toContain("id");
    expect(fields).toContain("fullName");
    expect(fields).not.toContain("email");
    expect(fields).not.toContain("canViewCommission");
  });

  it("an Admin sees the full record of a Team Member", () => {
    expect(visibleUserFields(ctx("admin"), { id: MEMBER, role: "team_member" })).toEqual(
      USER_FULL_FIELDS,
    );
  });

  it("a Team Member gets names only, for everyone", () => {
    const c = ctx("team_member");
    expect(visibleUserFields(c, { id: OTHER_MEMBER, role: "team_member" })).toEqual(
      USER_PUBLIC_FIELDS,
    );
    expect(visibleUserFields(c, { id: ADMIN, role: "admin" })).toEqual(USER_PUBLIC_FIELDS);
  });

  it("everyone sees their own record in full", () => {
    expect(visibleUserFields(ctx("team_member"), { id: MEMBER, role: "team_member" })).toEqual(
      USER_FULL_FIELDS,
    );
  });

  it("Super Admin sees every field of every record", () => {
    expect(visibleUserFields(ctx("super_admin"), { id: ADMIN, role: "admin" })).toEqual(
      USER_FULL_FIELDS,
    );
  });
});

describe("management capabilities", () => {
  it("only a Super Admin invites, deactivates or changes a role", () => {
    expect(canManageUsers(ctx("super_admin"))).toBe(true);
    expect(canManageUsers(ctx("admin"))).toBe(false);
    expect(canManageUsers(ctx("team_member"))).toBe(false);
  });

  it("erasure is Super Admin only — it is the one operation that destroys data", () => {
    expect(canErasePerson(ctx("super_admin"))).toBe(true);
    expect(canErasePerson(ctx("admin"))).toBe(false);
  });

  it("the unassigned inbox is a management view", () => {
    expect(canViewUnassignedInbox(ctx("super_admin"))).toBe(true);
    expect(canViewUnassignedInbox(ctx("admin"))).toBe(true);
    expect(canViewUnassignedInbox(ctx("team_member"))).toBe(false);
  });
});
