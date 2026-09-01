/**
 * THE AUDIT TRAIL — §16. Who, when, what changed.
 *
 * Append-only and polymorphic. Every mutation in the system routes through
 * `recordAudit`, which is why it takes a transaction: an audit row that can be
 * committed separately from the change it describes is not an audit trail, it
 * is a second source of truth that drifts.
 *
 * `before`/`after` hold CHANGED FIELDS ONLY, not whole rows. Whole-row
 * snapshots make the table enormous and the diff unreadable, and they capture
 * personal data into a table §31 erasure does not reach.
 */

import { auditLog } from "../db/schema";
import type { AuthContext } from "../auth/permissions";
import type { Tx } from "../auth/scoped";

export type AuditAction =
  | "created"
  | "updated"
  | "assigned"
  | "reassigned"
  | "stage_changed"
  | "won"
  | "lost"
  | "cancelled"
  | "merged"
  | "merge_reversed"
  | "cloned"
  | "commission_created"
  | "commission_reversed"
  | "commission_adjusted"
  | "target_changed"
  | "role_changed"
  | "activated"
  | "deactivated"
  | "erased"
  | "exported";

export type AuditEntity =
  | "person"
  | "company"
  | "opportunity"
  | "activity"
  | "user"
  | "target"
  | "commission_rule"
  | "commission_entry"
  | "event"
  | "edition"
  | "export";

type Writable = {
  insert: (table: typeof auditLog) => { values: (v: unknown) => Promise<unknown> };
};

/** Only the keys whose values actually differ. An "update" that changed
    nothing should leave no audit row claiming it did. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    const same =
      from === to ||
      (from instanceof Date && to instanceof Date && from.getTime() === to.getTime()) ||
      (from == null && to == null);
    if (!same) {
      b[key] = from ?? null;
      a[key] = to ?? null;
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}

export async function recordAudit(
  tx: Tx,
  input: {
    ctx: AuthContext | null;
    entityType: AuditEntity;
    entityId: string;
    action: AuditAction;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ipHash?: string | null;
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    /* Null actor is legitimate and meaningful: a website form submission has
       no acting user, and pretending one acted would be worse than a gap. */
    actorUserId: input.ctx?.userId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    ipHash: input.ipHash ?? null,
    createdBy: input.ctx?.userId ?? null,
  });
}
