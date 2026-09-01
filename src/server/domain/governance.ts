/**
 * AUDIT · EXPORT · ERASURE — §14, §15, §17.
 *
 * The three places where the system has to answer for itself: what happened,
 * what can leave, and what can be destroyed.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";

import {
  auditLog,
  commissionEntries,
  companies,
  editions,
  erasures,
  events,
  opportunities,
  people,
  personEmails,
  users,
} from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext } from "../auth/permissions";
import { canErasePerson, canManageUsers, canViewCommissionFor } from "../auth/permissions";
import { forbidden } from "../auth/context";
import { recordAudit } from "./audit";
import { opportunityFilterSql, type OpportunityFilters } from "./opportunities";
import { ValidationError } from "./opportunities";

type Maybe<T> = T | null | undefined;

/**
 * What an audit `before`/`after` payload may contain.
 *
 * A fully concrete JSON type with no `unknown` anywhere in it. jsonb reaches
 * TypeScript as `unknown`, and an `unknown` — even nested — fails the RPC
 * boundary's serialisation check. Same trap as the activity metadata in
 * activities.ts, one level deeper.
 */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type AuditPayload = { [key: string]: Json };

/* -------------------------------------------------------------- §17 · audit */

export type AuditRow = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before: AuditPayload | null;
  after: AuditPayload | null;
  occurredAt: Date;
};

/**
 * The trail. WHO · WHEN · WHAT CHANGED.
 *
 * Super Admin only. An Admin reading the full log would see target changes,
 * commission adjustments and role changes across the whole business, none of
 * which their event scope entitles them to — and the log is one table, so
 * there is no partial view of it that is both useful and safe.
 */
export async function auditTrail(
  q: ScopedQuery,
  ctx: AuthContext,
  filters: {
    entityType?: Maybe<string>;
    entityId?: Maybe<string>;
    actorUserId?: Maybe<string>;
    action?: Maybe<string>;
    since?: Maybe<Date>;
    limit?: Maybe<number>;
  } = {},
): Promise<AuditRow[]> {
  if (!canManageUsers(ctx)) {
    throw forbidden("The audit trail is visible to a Super Admin only.");
  }

  const conds = [];
  if (filters.entityType) conds.push(eq(auditLog.entityType, filters.entityType));
  if (filters.entityId) conds.push(eq(auditLog.entityId, filters.entityId));
  if (filters.actorUserId) conds.push(eq(auditLog.actorUserId, filters.actorUserId));
  if (filters.action) conds.push(eq(auditLog.action, filters.action));
  if (filters.since) conds.push(gte(auditLog.occurredAt, filters.since));

  return q.directory
    .select({
      id: auditLog.id,
      actorUserId: auditLog.actorUserId,
      actorName: users.fullName,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      action: auditLog.action,
      before: sql<AuditPayload | null>`${auditLog.before}`,
      after: sql<AuditPayload | null>`${auditLog.after}`,
      occurredAt: auditLog.occurredAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLog.occurredAt))
    .limit(Math.min(filters.limit ?? 200, 500));
}

/** The history of one record, for the screen that shows it. Scoped by the
    caller's reach rather than restricted to Super Admin: seeing who moved a
    deal you own is part of working it. */
export async function historyFor(q: ScopedQuery, entityType: string, entityId: string) {
  return q.directory
    .select({
      id: auditLog.id,
      actorName: users.fullName,
      action: auditLog.action,
      before: sql<AuditPayload | null>`${auditLog.before}`,
      after: sql<AuditPayload | null>`${auditLog.after}`,
      occurredAt: auditLog.occurredAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.occurredAt))
    .limit(100);
}

/* ------------------------------------------------------------- §14 · export */

export type ExportKind = "opportunities" | "people" | "companies" | "commission";

/**
 * CSV, with authorization respected.
 *
 * Export is the easiest way to defeat every permission in the system: one
 * download and the scoping is gone. So the rows come through the SAME scoped
 * queries the screens use — never a raw table read — and the export itself is
 * audited, because a copy of the pipeline leaving the building is an event
 * somebody may need to account for later.
 */
export async function exportCsv(
  q: ScopedQuery,
  ctx: AuthContext,
  kind: ExportKind,
  filters: OpportunityFilters = {},
): Promise<{ filename: string; csv: string; rows: number }> {
  if (!canManageUsers(ctx)) {
    throw forbidden("Export is available to a Super Admin only.");
  }

  let header: string[] = [];
  let body: (string | number | null)[][] = [];

  if (kind === "opportunities") {
    const rows = await q.directory
      .select({
        person: people.fullName,
        company: companies.name,
        jobTitle: people.jobTitle,
        country: people.country,
        function: opportunities.function,
        stage: opportunities.stageKey,
        owner: users.fullName,
        event: events.name,
        edition: editions.name,
        source: opportunities.source,
        estimatedValue: opportunities.estimatedValue,
        finalValue: opportunities.finalValue,
        currency: opportunities.currency,
        probability: opportunities.probability,
        lossReason: opportunities.lossReasonKey,
        cancellationReason: opportunities.cancellationReasonKey,
        withdrawalReason: opportunities.withdrawalReasonKey,
        createdAt: opportunities.createdAt,
        wonAt: opportunities.wonAt,
      })
      .from(opportunities)
      .innerJoin(people, eq(people.id, opportunities.personId))
      .innerJoin(editions, eq(editions.id, opportunities.editionId))
      .innerJoin(events, eq(events.id, editions.eventId))
      .leftJoin(companies, eq(companies.id, opportunities.companyId))
      .leftJoin(users, eq(users.id, opportunities.ownerId))
      .where(q.where.opportunities(opportunityFilterSql(filters)))
      .limit(10_000);

    header = Object.keys(rows[0] ?? { person: "" });
    body = rows.map((r) => Object.values(r).map(normalise));
  }

  if (kind === "people") {
    const rows = await q.directory
      .select({
        fullName: people.fullName,
        jobTitle: people.jobTitle,
        company: companies.name,
        phone: people.phone,
        country: people.country,
        verified: people.isVerified,
        erased: sql<boolean>`${people.erasedAt} is not null`,
        emails: sql<string>`coalesce((
          select string_agg(pe.email, ' ') from person_emails pe where pe.person_id = ${people.id}
        ), '')`,
        createdAt: people.createdAt,
      })
      .from(people)
      .leftJoin(companies, eq(companies.id, people.companyId))
      .where(sql`${people.mergedIntoId} is null`)
      .limit(10_000);

    header = Object.keys(rows[0] ?? { fullName: "" });
    body = rows.map((r) => Object.values(r).map(normalise));
  }

  if (kind === "companies") {
    const rows = await q.directory
      .select({
        name: companies.name,
        country: companies.country,
        website: companies.website,
        people: sql<number>`(select count(*)::int from people p
          where p.company_id = ${companies.id} and p.merged_into_id is null)`,
        createdAt: companies.createdAt,
      })
      .from(companies)
      .where(sql`${companies.mergedIntoId} is null`)
      .limit(10_000);

    header = Object.keys(rows[0] ?? { name: "" });
    body = rows.map((r) => Object.values(r).map(normalise));
  }

  if (kind === "commission") {
    const rows = await q.directory
      .select({
        person: users.fullName,
        entryType: commissionEntries.entryType,
        amount: commissionEntries.amount,
        currency: commissionEntries.currency,
        baseValue: commissionEntries.baseValue,
        splitPct: commissionEntries.splitPct,
        lockedBasis: commissionEntries.lockedBasis,
        lockedRatePct: commissionEntries.lockedRatePct,
        effectiveAt: commissionEntries.effectiveAt,
        note: commissionEntries.note,
      })
      .from(commissionEntries)
      .innerJoin(users, eq(users.id, commissionEntries.userId))
      .where(q.where.commissionEntries())
      .limit(10_000);

    header = Object.keys(rows[0] ?? { person: "" });
    body = rows.map((r) => Object.values(r).map(normalise));
  }

  const csv = [header.map(csvCell).join(","), ...body.map((r) => r.map(csvCell).join(","))].join(
    "\r\n",
  );

  await q.directory.transaction(async (tx) => {
    await recordAudit(tx, {
      ctx,
      entityType: "export",
      entityId: ctx.userId,
      action: "exported",
      after: { kind, rows: body.length, filters },
    });
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return { filename: `financial-rails-${kind}-${stamp}.csv`, csv, rows: body.length };
}

function normalise(value: unknown): string | number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return value;
  return String(value);
}

/**
 * CSV escaping, including the injection guard.
 *
 * A cell beginning `=`, `+`, `-` or `@` is executed as a formula when the file
 * is opened in Excel or Sheets. A person named `=cmd|...` is a real attack, and
 * the data here comes from a public web form. Prefixing with an apostrophe is
 * the standard neutralisation and is invisible in the spreadsheet.
 */
function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const text = String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  if (/[",\r\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

/* ------------------------------------------------------------ §15 · erasure */

/** The personal fields cleared. Named here so the audit record and the
    implementation cannot disagree about what "erased" means. */
export const ERASABLE_FIELDS = ["fullName", "jobTitle", "phone", "country", "emails"] as const;

/**
 * Erase a person's personal data, keep the commercial history.
 *
 * The one operation in the system that destroys anything. Super Admin only.
 *
 * What survives: every opportunity, activity, commission entry and audit row,
 * still linked to the same person id. What goes: the name, job title, phone,
 * country and every email address. The person becomes `Erased person` and the
 * deals they were part of remain countable, reportable and reconcilable.
 *
 * The erasure record stores field NAMES only. Storing what was erased would
 * defeat the entire purpose, and it is the obvious mistake to make.
 */
export async function erasePerson(
  q: ScopedQuery,
  personId: string,
  reason: string | null,
  ctx: AuthContext,
): Promise<{ fieldsCleared: string[]; opportunitiesPreserved: number }> {
  if (!canErasePerson(ctx)) throw forbidden("Only a Super Admin can erase personal data.");

  return q.directory.transaction(async (tx) => {
    const existing = await tx
      .select({ id: people.id, erasedAt: people.erasedAt })
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);
    if (!existing[0]) throw new ValidationError("That person does not exist.");
    if (existing[0].erasedAt) throw new ValidationError("That person has already been erased.");

    const kept = await tx
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.personId, personId));

    await tx.delete(personEmails).where(eq(personEmails.personId, personId));

    await tx
      .update(people)
      .set({
        fullName: "Erased person",
        normalizedName: "erased person",
        jobTitle: null,
        phone: null,
        country: null,
        isVerified: false,
        erasedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(people.id, personId));

    await tx.insert(erasures).values({
      personId,
      /* NAMES ONLY. */
      fieldsCleared: [...ERASABLE_FIELDS],
      reason,
      performedBy: ctx.userId,
      createdBy: ctx.userId,
    });

    await recordAudit(tx, {
      ctx,
      entityType: "person",
      entityId: personId,
      action: "erased",
      after: { fieldsCleared: [...ERASABLE_FIELDS], opportunitiesPreserved: kept.length, reason },
    });

    return { fieldsCleared: [...ERASABLE_FIELDS], opportunitiesPreserved: kept.length };
  });
}

/** The erasure register — what was erased, by whom, when. Never what it said. */
export async function erasureRegister(q: ScopedQuery, ctx: AuthContext) {
  if (!canErasePerson(ctx)) throw forbidden("The erasure register is Super Admin only.");
  return q.directory
    .select({
      id: erasures.id,
      personId: erasures.personId,
      fieldsCleared: sql<string[]>`${erasures.fieldsCleared}`,
      reason: erasures.reason,
      performedAt: erasures.performedAt,
      performedByName: users.fullName,
    })
    .from(erasures)
    .leftJoin(users, eq(users.id, erasures.performedBy))
    .orderBy(desc(erasures.performedAt))
    .limit(200);
}

/** Commission visibility is a separate grant; the export honours it. */
export function canExportCommission(ctx: AuthContext, forUserId: string) {
  return canViewCommissionFor(ctx, forUserId);
}
