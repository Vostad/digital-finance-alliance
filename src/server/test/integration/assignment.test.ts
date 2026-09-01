/**
 * OWNERSHIP — §7 and §39 scenarios 3, 8, 25, 26, plus concurrent assignment.
 *
 * The property under test: ownership is per workstream. Three owners on one
 * person is normal, not a conflict.
 */

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { activities, auditLog, opportunities } from "@/server/db/schema";
import { assignMany, assignOwner, assignableUsers, setSplit } from "@/server/domain/assignment";
import { createLead } from "@/server/domain/leads";
import { listOpportunities } from "@/server/domain/opportunities";
import { withFixture } from "./fixture";

const R: Record<string, unknown> = {};

beforeAll(async () => {
  await withFixture(async ({ tx, ids, ctx, q }) => {
    const sa = q("superAdmin");

    const lead = await createLead(
      sa,
      {
        fullName: "John Smith",
        companyName: "ABC Bank",
        email: "john.smith@abcbank.com",
        functions: ["sponsor", "speaker", "delegate"],
        editionId: ids.editionMena,
        estimatedValue: "80000.00",
      },
      ctx("superAdmin"),
    );

    const all = await listOpportunities(sa);
    const byFn = Object.fromEntries(all.map((o) => [o.function, o.id])) as Record<string, string>;
    R["startsUnassigned"] = all.every((o) => o.ownerId === null);

    /* Three owners, one person. */
    await assignOwner(sa, byFn["sponsor"]!, ids.memberSponsor, ctx("superAdmin"));
    await assignOwner(sa, byFn["speaker"]!, ids.memberSpeaker, ctx("superAdmin"));
    await assignOwner(sa, byFn["delegate"]!, ids.memberDelegate, ctx("superAdmin"));

    const owners = await tx
      .select({ fn: opportunities.function, ownerId: opportunities.ownerId })
      .from(opportunities);
    R["ownersByFunction"] = Object.fromEntries(owners.map((o) => [o.fn, o.ownerId]));
    R["distinctOwners"] = new Set(owners.map((o) => o.ownerId)).size;

    /* Each owner now sees exactly their own workstream. */
    R["sponsorSees"] = (await listOpportunities(q("memberSponsor"))).length;
    R["speakerSees"] = (await listOpportunities(q("memberSpeaker"))).length;

    /* A Team Member cannot assign — not even their own work. */
    try {
      await assignOwner(
        q("memberSponsor"),
        byFn["sponsor"]!,
        ids.memberSpeaker,
        ctx("memberSponsor"),
      );
      R["memberCouldAssign"] = true;
    } catch (error) {
      R["memberCouldAssign"] = false;
      R["memberAssignMessage"] = (error as Error).message;
    }

    /* An Admin can assign inside their scope. */
    await assignOwner(q("adminMena"), byFn["sponsor"]!, ids.superAdmin, ctx("adminMena"));
    const reassigned = await tx
      .select({ ownerId: opportunities.ownerId })
      .from(opportunities)
      .where(eq(opportunities.id, byFn["sponsor"]!));
    R["adminReassigned"] = reassigned[0]?.ownerId === ids.superAdmin;

    /* An Admin cannot reach outside their scope. */
    const asiaLead = await createLead(
      sa,
      { fullName: "Asia Contact", functions: ["sponsor"], editionId: ids.editionAsia },
      ctx("superAdmin"),
    );
    try {
      await assignOwner(
        q("adminMena"),
        asiaLead.opportunityIds[0]!,
        ids.memberSponsor,
        ctx("adminMena"),
      );
      R["adminEscapedScope"] = true;
    } catch {
      R["adminEscapedScope"] = false;
    }

    /* Function integrity: a sponsor deal cannot go to a delegate-only member. */
    try {
      await assignOwner(sa, byFn["sponsor"]!, ids.memberDelegate, ctx("superAdmin"));
      R["wrongFunctionAssigned"] = true;
    } catch (error) {
      R["wrongFunctionAssigned"] = false;
      R["wrongFunctionMessage"] = (error as Error).message;
    }

    /* Unassigning is legitimate — back to the Super Admin inbox. */
    await assignOwner(sa, byFn["delegate"]!, null, ctx("superAdmin"));
    R["backToInbox"] = (await listOpportunities(sa, { unassignedOnly: true })).length;

    /* Every change is audited and leaves an activity. */
    const audits = await tx
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, byFn["sponsor"]!));
    R["sponsorAudits"] = audits.map((a) => a.action).sort();
    const acts = await tx
      .select({ type: activities.type })
      .from(activities)
      .where(eq(activities.opportunityId, byFn["sponsor"]!));
    R["assignmentActivities"] = acts.filter((a) => a.type === "assignment").length;

    /* Splits. */
    const split = await setSplit(
      sa,
      byFn["speaker"]!,
      { secondaryOwnerId: ids.superAdmin, ownerSplitPct: 60 },
      ctx("superAdmin"),
    );
    R["split"] = split;

    try {
      await setSplit(
        sa,
        byFn["speaker"]!,
        { secondaryOwnerId: ids.memberSpeaker, ownerSplitPct: 50 },
        ctx("superAdmin"),
      );
      R["selfSplitRefused"] = false;
    } catch {
      R["selfSplitRefused"] = true;
    }

    /* Bulk assignment checks every record individually. */
    const bulk = await assignMany(
      q("adminMena"),
      [byFn["delegate"]!, asiaLead.opportunityIds[0]!],
      ids.memberDelegate,
      ctx("adminMena"),
    );
    R["bulkAssigned"] = bulk.assigned.length;
    R["bulkRefused"] = bulk.refused.length;

    /* Assignable users are filtered by function. */
    const forSponsor = await assignableUsers(sa, "sponsor");
    R["assignableForSponsor"] = forSponsor.map((u) => u.id).includes(ids.memberDelegate);

    return true;
  });
});

describe("ownership is per workstream", () => {
  it("everything starts unassigned", () => expect(R["startsUnassigned"]).toBe(true));
  it("three functions, three different owners, one person", () =>
    expect(R["distinctOwners"]).toBe(3));
  it("each owner sees exactly their own", () => {
    expect(R["sponsorSees"]).toBe(1);
    expect(R["speakerSees"]).toBe(1);
  });
});

describe("who may assign", () => {
  it("a Team Member cannot — not even their own work", () => {
    expect(R["memberCouldAssign"]).toBe(false);
    expect(R["memberAssignMessage"]).toMatch(/Super Admin or a scoped Admin/i);
  });
  it("an Admin can, inside their scope", () => expect(R["adminReassigned"]).toBe(true));
  it("AN ADMIN CANNOT ESCAPE THEIR EVENT SCOPE", () => expect(R["adminEscapedScope"]).toBe(false));
});

describe("an owner must be able to do the work", () => {
  it("a sponsor deal cannot be assigned to a delegate-only member", () => {
    expect(R["wrongFunctionAssigned"]).toBe(false);
    expect(R["wrongFunctionMessage"]).toMatch(/not assigned to sponsor work/i);
  });
  it("that member is not offered as an assignee either", () =>
    expect(R["assignableForSponsor"]).toBe(false));
});

describe("unassigning returns work to the inbox", () => {
  it("owner_id NULL is a real state, not a gap", () => expect(R["backToInbox"]).toBe(2));
});

describe("nothing changes silently", () => {
  it("the audit names creation, assignment and reassignment", () =>
    expect(R["sponsorAudits"]).toEqual(["assigned", "created", "reassigned"]));
  it("each assignment leaves an activity on the timeline", () =>
    expect(R["assignmentActivities"]).toBe(2));
});

describe("commission splits", () => {
  it("the two shares total 100", () =>
    expect(R["split"]).toEqual({ ownerSplitPct: 60, secondarySplitPct: 40 }));
  it("the secondary owner cannot be the owner", () => expect(R["selfSplitRefused"]).toBe(true));
});

describe("bulk assignment is a convenience, not a bypass", () => {
  it("assigns what the caller may assign", () => expect(R["bulkAssigned"]).toBe(1));
  it("REFUSES what is outside their scope, per record", () => expect(R["bulkRefused"]).toBe(1));
});
