/**
 * OWNERSHIP — §7. Per workstream, never per person.
 *
 * One person can be worked as a sponsor by Ahmed, a speaker by Sara and a
 * delegate by Imran at the same time. Ownership therefore lives on the
 * opportunity and nowhere else — a person-level "account owner" would force
 * exactly the duplication the whole system exists to prevent.
 *
 * `owner_id IS NULL` is a real, meaningful state, not a gap waiting to be
 * filled: it defines the Super Admin inbox, and every website lead starts
 * there.
 */

import { eq, inArray } from "drizzle-orm";

import { activities, opportunities, userFunctions, users } from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext, WorkFunction } from "../auth/permissions";
import { canAssignOpportunity } from "../auth/permissions";
import { forbidden } from "../auth/context";
import { recordAudit } from "./audit";
import { ValidationError, loadForWrite } from "./opportunities";

/**
 * An owner must be active and must actually hold the function.
 *
 * Assigning a sponsor deal to someone who only does delegate work would hand
 * them a workstream their own dashboard is built never to show them — the deal
 * would be owned and invisible at the same time, which is the definition of a
 * hidden lead.
 */
async function assertAssignable(
  q: ScopedQuery,
  userId: string,
  fn: WorkFunction,
): Promise<{ fullName: string }> {
  const rows = await q.directory
    .select({ id: users.id, fullName: users.fullName, status: users.status, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) throw new ValidationError("That team member does not exist.");
  if (user.status !== "active") {
    throw new ValidationError(`${user.fullName}'s account is not active.`);
  }

  /* Super Admins and Admins work every function by definition; only Team
     Members carry an explicit function list. */
  if (user.role === "team_member") {
    const held = await q.directory
      .select({ function: userFunctions.function })
      .from(userFunctions)
      .where(eq(userFunctions.userId, userId));
    if (!held.some((h) => h.function === fn)) {
      throw new ValidationError(`${user.fullName} is not assigned to ${fn} work.`);
    }
  }

  return { fullName: user.fullName };
}

export async function assignOwner(
  q: ScopedQuery,
  opportunityId: string,
  ownerId: string | null,
  ctx: AuthContext,
): Promise<{ id: string; ownerId: string | null }> {
  const current = await loadForWrite(q, opportunityId, ctx);
  if (!canAssignOpportunity(ctx, current)) {
    throw forbidden("Only a Super Admin or a scoped Admin can assign ownership.");
  }

  if (ownerId) await assertAssignable(q, ownerId, current.function);

  if (current.ownerId === ownerId) return { id: opportunityId, ownerId };

  return q.directory.transaction(async (tx) => {
    await tx
      .update(opportunities)
      .set({ ownerId, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(eq(opportunities.id, opportunityId));

    await tx.insert(activities).values({
      opportunityId,
      userId: ctx.userId,
      type: "assignment",
      metadata: { from: current.ownerId, to: ownerId },
      createdBy: ctx.userId,
    });

    await recordAudit(tx, {
      ctx,
      entityType: "opportunity",
      entityId: opportunityId,
      action: current.ownerId ? "reassigned" : "assigned",
      before: { ownerId: current.ownerId },
      after: { ownerId },
    });

    return { id: opportunityId, ownerId };
  });
}

/**
 * §10 — a secondary owner and the split that governs their commission.
 *
 * The split is stored on the opportunity and copied onto the commission entry
 * at WON, so changing it afterwards cannot reach backwards into money already
 * earned. The database enforces that the two shares total 100.
 */
export async function setSplit(
  q: ScopedQuery,
  opportunityId: string,
  input: { secondaryOwnerId: string | null; ownerSplitPct: number },
  ctx: AuthContext,
): Promise<{ ownerSplitPct: number; secondarySplitPct: number }> {
  const current = await loadForWrite(q, opportunityId, ctx);
  if (!canAssignOpportunity(ctx, current)) {
    throw forbidden("Only a Super Admin or a scoped Admin can change a commission split.");
  }
  if (input.ownerSplitPct < 0 || input.ownerSplitPct > 100) {
    throw new ValidationError("The owner's share must be between 0 and 100 percent.");
  }
  if (input.secondaryOwnerId) {
    if (input.secondaryOwnerId === current.ownerId) {
      throw new ValidationError("The secondary owner must be someone other than the owner.");
    }
    await assertAssignable(q, input.secondaryOwnerId, current.function);
  }

  const ownerSplitPct = input.secondaryOwnerId ? input.ownerSplitPct : 100;
  const secondarySplitPct = 100 - ownerSplitPct;

  return q.directory.transaction(async (tx) => {
    await tx
      .update(opportunities)
      .set({
        secondaryOwnerId: input.secondaryOwnerId,
        ownerSplitPct,
        secondarySplitPct,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(opportunities.id, opportunityId));

    await recordAudit(tx, {
      ctx,
      entityType: "opportunity",
      entityId: opportunityId,
      action: "updated",
      before: { secondaryOwnerId: current.secondaryOwnerId },
      after: { secondaryOwnerId: input.secondaryOwnerId, ownerSplitPct, secondarySplitPct },
    });

    return { ownerSplitPct, secondarySplitPct };
  });
}

/**
 * Assign a batch out of the unassigned inbox. Each is checked individually —
 * a bulk action is a convenience for the operator, never a way around the
 * per-record permission check.
 */
export async function assignMany(
  q: ScopedQuery,
  opportunityIds: string[],
  ownerId: string,
  ctx: AuthContext,
): Promise<{ assigned: string[]; refused: { id: string; reason: string }[] }> {
  const assigned: string[] = [];
  const refused: { id: string; reason: string }[] = [];

  for (const id of opportunityIds) {
    try {
      await assignOwner(q, id, ownerId, ctx);
      assigned.push(id);
    } catch (error) {
      refused.push({ id, reason: (error as Error).message });
    }
  }
  return { assigned, refused };
}

/** Team members this caller may assign work to. */
export async function assignableUsers(q: ScopedQuery, fn?: WorkFunction | null) {
  const rows = await q.directory
    .select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(inArray(users.status, ["active"]));

  if (!fn) return rows;

  const held = await q.directory
    .select({ userId: userFunctions.userId, function: userFunctions.function })
    .from(userFunctions);
  const byUser = new Map<string, string[]>();
  for (const h of held) byUser.set(h.userId, [...(byUser.get(h.userId) ?? []), h.function]);

  return rows.filter((r) => r.role !== "team_member" || (byUser.get(r.id) ?? []).includes(fn));
}
