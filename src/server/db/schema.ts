/**
 * FINANCIAL RAILS OS — the approved Gate 1 data model, as Drizzle schema.
 *
 * This file is the SINGLE SOURCE OF TRUTH for the database. drizzle-kit owns
 * the migration history; the Supabase CLI never writes schema. See
 * docs/fr-os/migrations.md for why, and for the one discipline rule that
 * choice imposes (no DDL through the Supabase Studio SQL editor).
 *
 * CONVENTIONS, applied to every table and stated once here:
 *   · uuid primary keys, generated in the database
 *   · every timestamp is timestamptz, stored UTC — the team spans Dubai and
 *     India and a naive timestamp puts follow-ups on the wrong day
 *   · every monetary column is numeric(14,2) and carries a currency alongside
 *   · created_at/by and updated_at/by everywhere, except the two append-only
 *     tables (activities, auditLog) which carry only the created pair
 *   · no hard delete: archivedAt, mergedIntoId, or a terminal status. The one
 *     exception is §39 erasure, which is audited in its own table
 *
 * RLS is NOT expressed here — Drizzle does not model policies. It lives in
 * the hand-written migration that follows the generated DDL, and it is
 * default-deny on every table in this file.
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ auth.users
   Supabase owns this table. We declare only the column we key against so
   Drizzle can express the foreign key; we never read or write it directly —
   account creation and refresh-token revocation go through the Auth admin API. */

const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

/* ---------------------------------------------------------------------- enums */

export const userRole = pgEnum("user_role", ["super_admin", "admin", "team_member"]);
export const userStatus = pgEnum("user_status", ["invited", "active", "deactivated"]);
export const workFunction = pgEnum("work_function", ["sponsor", "delegate", "speaker"]);
export const eventStatus = pgEnum("event_status", ["active", "archived"]);
export const editionStatus = pgEnum("edition_status", ["planning", "active", "closed"]);
export const leadSource = pgEnum("lead_source", [
  "website",
  "manual",
  "import",
  "referral",
  "event",
  "other",
]);
export const opportunityPriority = pgEnum("opportunity_priority", ["normal", "high"]);
export const activityType = pgEnum("activity_type", [
  "call",
  "email",
  "meeting",
  "follow_up",
  "note",
  "proposal",
  "status_change",
  "assignment",
  "other",
]);
export const formType = pgEnum("form_type", ["prospectus", "apply"]);
export const submissionStatus = pgEnum("submission_status", [
  "processed",
  "rejected_spam",
  "failed",
]);
export const targetMetric = pgEnum("target_metric", ["revenue", "count"]);
export const commissionBasis = pgEnum("commission_basis", [
  "percentage",
  "fixed_per_deal",
  "tiered",
]);
export const commissionEntryType = pgEnum("commission_entry_type", [
  "earned",
  "adjustment",
  "reversal",
]);
export const mergeEntityType = pgEnum("merge_entity_type", ["person", "company"]);

/* ------------------------------------------------------------------ audit cols
   Spread into every table. `createdBy` is nullable because system actions —
   a website form submission — have no acting user. */

const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
};

const appendOnlyStamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
};

/* ==========================================================================
   IDENTITY AND ACCESS
   ========================================================================== */

/**
 * Our own users table, keyed 1:1 to auth.users.id.
 *
 * Role, functions, event scopes and the commission grants live HERE and never
 * in JWT claims or auth metadata. Claims are cached in the token; a revoked
 * role must take effect on the next request, not the next refresh.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    role: userRole("role").notNull().default("team_member"),
    status: userStatus("status").notNull().default("invited"),
    /** IANA name. Every timestamp is stored UTC and rendered through this. */
    timezone: text("timezone").notNull().default("Asia/Dubai"),
    /** §22 — the explicit grant. Admin only, off by default. */
    canViewCommission: boolean("can_view_commission").notNull().default(false),
    /** §1 — the explicit grant. Admin only, off by default. */
    canManageCommissionRules: boolean("can_manage_commission_rules").notNull().default(false),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    ...stamps,
  },
  (t) => [
    uniqueIndex("users_email_key").on(sql`lower(${t.email})`),
    index("users_role_status_idx").on(t.role, t.status),
  ],
);

export const userFunctions = pgTable(
  "user_functions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    function: workFunction("function").notNull(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.function] })],
);

/** §1 — Admin scope is per EVENT, explicit, never inferred. */
export const userEventScopes = pgTable(
  "user_event_scopes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

/**
 * Invitations. Supabase Auth issues the credential; this row carries the
 * domain configuration (role, functions, scopes) that was set before the
 * person ever logged in.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...stamps,
  },
  (t) => [index("invitations_user_idx").on(t.userId)],
);

/* ==========================================================================
   EVENTS
   ========================================================================== */

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    region: text("region"),
    status: eventStatus("status").notNull().default("active"),
    ...stamps,
  },
  (t) => [uniqueIndex("events_slug_key").on(t.slug)],
);

export const editions = pgTable(
  "editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    city: text("city"),
    country: text("country"),
    /** Dates, not timestamps — an edition spans days, not moments. */
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    status: editionStatus("status").notNull().default("planning"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("editions_event_slug_key").on(t.eventId, t.slug),
    index("editions_event_idx").on(t.eventId),
  ],
);

/* ==========================================================================
   PEOPLE AND COMPANIES
   ========================================================================== */

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Lowercased, punctuation stripped. Fallback identity when no domain. §4 */
    normalizedName: text("normalized_name").notNull(),
    website: text("website"),
    country: text("country"),
    mergedIntoId: uuid("merged_into_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...stamps,
  },
  (t) => [
    index("companies_normalized_name_idx").on(t.normalizedName),
    index("companies_merged_into_idx").on(t.mergedIntoId),
    foreignKey({
      columns: [t.mergedIntoId],
      foreignColumns: [t.id],
      name: "companies_merged_into_fk",
    }).onDelete("restrict"),
  ],
);

/** §4 — primary company identity. Free mail hosts are blocked in application code. */
export const companyDomains = pgTable(
  "company_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...stamps,
  },
  (t) => [
    uniqueIndex("company_domains_domain_key").on(sql`lower(${t.domain})`),
    index("company_domains_company_idx").on(t.companyId),
  ],
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    fullName: text("full_name").notNull(),
    /** Half the no-email match key. §4 */
    normalizedName: text("normalized_name").notNull(),
    jobTitle: text("job_title"),
    phone: text("phone"),
    country: text("country"),
    /** False until an email exists. §4 */
    isVerified: boolean("is_verified").notNull().default(false),
    mergedIntoId: uuid("merged_into_id"),
    /** §39 — PII columns nulled, commercial history preserved. */
    erasedAt: timestamp("erased_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...stamps,
  },
  (t) => [
    index("people_company_idx").on(t.companyId),
    index("people_normalized_name_idx").on(t.normalizedName),
    index("people_merged_into_idx").on(t.mergedIntoId),
    foreignKey({
      columns: [t.mergedIntoId],
      foreignColumns: [t.id],
      name: "people_merged_into_fk",
    }).onDelete("restrict"),
  ],
);

/**
 * The actual identity key. This unique constraint IS the "one person, one
 * record" rule — a second address attaches here rather than forking a person.
 */
export const personEmails = pgTable(
  "person_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...stamps,
  },
  (t) => [
    uniqueIndex("person_emails_email_key").on(sql`lower(${t.email})`),
    uniqueIndex("person_emails_one_primary_key")
      .on(t.personId)
      .where(sql`${t.isPrimary}`),
    index("person_emails_person_idx").on(t.personId),
  ],
);

/* ==========================================================================
   PIPELINE REFERENCE — seeded rows, fixed. Only probability is editable.
   ========================================================================== */

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    function: workFunction("function").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull(),
    /** §16 — the only editable column. Sponsor seeds 5/10/25/40/60/80/100/0. */
    defaultProbability: integer("default_probability").notNull().default(0),
    isOpen: boolean("is_open").notNull().default(true),
    isWon: boolean("is_won").notNull().default(false),
    isLost: boolean("is_lost").notNull().default(false),
    /** §22 — CANCELLED is a distinct state from LOST. */
    isCancelled: boolean("is_cancelled").notNull().default(false),
    ...stamps,
  },
  (t) => [
    uniqueIndex("pipeline_stages_function_key").on(t.function, t.key),
    check(
      "pipeline_stages_probability_range",
      sql`${t.defaultProbability} >= 0 AND ${t.defaultProbability} <= 100`,
    ),
  ],
);

export const lossReasons = pgTable(
  "loss_reasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    function: workFunction("function").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull(),
    ...stamps,
  },
  (t) => [uniqueIndex("loss_reasons_function_key").on(t.function, t.key)],
);

/* ==========================================================================
   OPPORTUNITIES — the workstream. There is no `leads` table: a lead is an
   opportunity at stage NEW.
   ========================================================================== */

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    /** Snapshot. If the person changes employer, a won deal stays attributed
        to who actually paid. Confirmed at Gate 1. */
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    function: workFunction("function").notNull(),
    stageKey: text("stage_key").notNull(),
    /** Nullable by design: an unassigned website lead has no owner, and the
        Super Admin inbox is defined as `owner_id IS NULL`. §8/§17 */
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "restrict" }),
    secondaryOwnerId: uuid("secondary_owner_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    ownerSplitPct: integer("owner_split_pct").notNull().default(100),
    secondarySplitPct: integer("secondary_split_pct").notNull().default(0),
    source: leadSource("source").notNull().default("manual"),
    priority: opportunityPriority("priority").notNull().default("normal"),
    estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
    /** Set at WON. The only commission base. §22 */
    finalValue: numeric("final_value", { precision: 14, scale: 2 }),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    probability: integer("probability").notNull().default(0),
    /** §16 — so the forecast can be read both ways. */
    probabilityOverridden: boolean("probability_overridden").notNull().default(false),
    lossReasonKey: text("loss_reason_key"),
    nextAction: text("next_action"),
    nextActionDueAt: timestamp("next_action_due_at", { withTimezone: true }),
    /** The rate-locking date. §22 */
    wonAt: timestamp("won_at", { withTimezone: true }),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    /** The whole renewal motion. §34 */
    clonedFromId: uuid("cloned_from_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...stamps,
  },
  (t) => [
    index("opportunities_owner_stage_idx").on(t.ownerId, t.stageKey),
    index("opportunities_edition_function_stage_idx").on(t.editionId, t.function, t.stageKey),
    index("opportunities_company_idx").on(t.companyId),
    index("opportunities_person_idx").on(t.personId),
    index("opportunities_next_action_idx")
      .on(t.nextActionDueAt)
      .where(sql`${t.archivedAt} is null`),
    index("opportunities_won_idx")
      .on(t.wonAt)
      .where(sql`${t.wonAt} is not null`),
    /** The Super Admin inbox, as a database property rather than a convention. */
    index("opportunities_unassigned_idx")
      .on(t.createdAt)
      .where(sql`${t.ownerId} is null and ${t.archivedAt} is null`),
    foreignKey({
      columns: [t.clonedFromId],
      foreignColumns: [t.id],
      name: "opportunities_cloned_from_fk",
    }).onDelete("set null"),
    check("opportunities_split_totals_100", sql`${t.ownerSplitPct} + ${t.secondarySplitPct} = 100`),
    check(
      "opportunities_probability_range",
      sql`${t.probability} >= 0 AND ${t.probability} <= 100`,
    ),
  ],
);

/** §10 — append-only. Never deleted, never updated. */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }),
    type: activityType("type").notNull(),
    /** Distinct from createdAt — you can log yesterday's call today. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    /** The "private notes" of §33. */
    notes: text("notes"),
    /** For status_change and assignment: the before and after. */
    metadata: jsonb("metadata"),
    ...appendOnlyStamps,
  },
  (t) => [index("activities_opportunity_occurred_idx").on(t.opportunityId, t.occurredAt.desc())],
);

/* ==========================================================================
   WEBSITE INTAKE
   ========================================================================== */

/** §8 — the raw truth, kept verbatim even when matching merges the person. */
export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formType: formType("form_type").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    submittedEmail: text("submitted_email"),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
      onDelete: "set null",
    }),
    status: submissionStatus("status").notNull().default("processed"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    ...appendOnlyStamps,
  },
  (t) => [index("form_submissions_status_created_idx").on(t.status, t.createdAt.desc())],
);

/* ==========================================================================
   TARGETS AND COMMISSION
   ========================================================================== */

export const targets = pgTable(
  "targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Both nullable — a target may span an event or pin to one edition. §19 */
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    editionId: uuid("edition_id").references(() => editions.id, { onDelete: "cascade" }),
    function: workFunction("function").notNull(),
    /** Sponsor targets are money; speaker and delegate targets are people. §19 */
    metric: targetMetric("metric").notNull(),
    targetValue: numeric("target_value", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    ...stamps,
  },
  (t) => [
    index("targets_user_edition_function_idx").on(t.userId, t.editionId, t.function),
    check(
      "targets_currency_required_for_revenue",
      sql`(${t.metric} <> 'revenue') OR (${t.currency} IS NOT NULL)`,
    ),
  ],
);

/** §21 — configurable. No percentage is hardcoded anywhere in the system. */
export const commissionRules = pgTable(
  "commission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    function: workFunction("function").notNull(),
    scopeEventId: uuid("scope_event_id").references(() => events.id, { onDelete: "cascade" }),
    scopeEditionId: uuid("scope_edition_id").references(() => editions.id, { onDelete: "cascade" }),
    scopeUserId: uuid("scope_user_id").references(() => users.id, { onDelete: "cascade" }),
    basis: commissionBasis("basis").notNull(),
    ratePct: numeric("rate_pct", { precision: 6, scale: 3 }),
    fixedAmount: numeric("fixed_amount", { precision: 14, scale: 2 }),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    /** Rules are versioned in time, never edited in place. §22 */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    ...stamps,
  },
  (t) => [
    index("commission_rules_function_effective_idx").on(t.function, t.effectiveFrom),
    check(
      "commission_rules_basis_fields",
      sql`(${t.basis} = 'percentage' AND ${t.ratePct} IS NOT NULL)
       OR (${t.basis} = 'fixed_per_deal' AND ${t.fixedAmount} IS NOT NULL)
       OR (${t.basis} = 'tiered')`,
    ),
  ],
);

export const commissionRuleTiers = pgTable(
  "commission_rule_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => commissionRules.id, { onDelete: "cascade" }),
    minValue: numeric("min_value", { precision: 14, scale: 2 }).notNull(),
    /** Nullable for the open top band. */
    maxValue: numeric("max_value", { precision: 14, scale: 2 }),
    ratePct: numeric("rate_pct", { precision: 6, scale: 3 }),
    fixedAmount: numeric("fixed_amount", { precision: 14, scale: 2 }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...stamps,
  },
  (t) => [index("commission_rule_tiers_rule_idx").on(t.ruleId)],
);

/**
 * §22 — the rate-locking mechanism, as an append-only ledger.
 *
 * Rows are NEVER updated or deleted. A revision or reversal appends a new row;
 * the balance for a user on an opportunity is SUM(amount). The locked_* columns
 * are copied from the rule at the moment the opportunity was marked WON, so
 * changing a commission rule afterwards cannot reach backwards into it.
 */
export const commissionEntries = pgTable(
  "commission_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Provenance only — never re-read to recompute. */
    ruleId: uuid("rule_id").references(() => commissionRules.id, { onDelete: "set null" }),
    entryType: commissionEntryType("entry_type").notNull(),
    /** GATE 2 ADDITION 1 — a WON → CANCELLED → WON cycle must preserve an
        explicit reversal relationship in the ledger and the audit trail. */
    reversesEntryId: uuid("reverses_entry_id"),
    lockedBasis: commissionBasis("locked_basis").notNull(),
    lockedRatePct: numeric("locked_rate_pct", { precision: 6, scale: 3 }),
    lockedFixedAmount: numeric("locked_fixed_amount", { precision: 14, scale: 2 }),
    /** Full tier table snapshot at WON. */
    lockedTiers: jsonb("locked_tiers"),
    baseValue: numeric("base_value", { precision: 14, scale: 2 }).notNull(),
    splitPct: integer("split_pct").notNull().default(100),
    /** Signed. A reversal is negative; the balance is a SUM. */
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    ...appendOnlyStamps,
  },
  (t) => [
    index("commission_entries_user_effective_idx").on(t.userId, t.effectiveAt),
    index("commission_entries_opportunity_idx").on(t.opportunityId),
    index("commission_entries_reverses_idx").on(t.reversesEntryId),
    foreignKey({
      columns: [t.reversesEntryId],
      foreignColumns: [t.id],
      name: "commission_entries_reverses_fk",
    }).onDelete("restrict"),
    /** A reversal must say what it reverses; nothing else may. */
    check(
      "commission_entries_reversal_link",
      sql`(${t.entryType} = 'reversal' AND ${t.reversesEntryId} IS NOT NULL)
       OR (${t.entryType} <> 'reversal' AND ${t.reversesEntryId} IS NULL)`,
    ),
  ],
);

/* ==========================================================================
   GOVERNANCE
   ========================================================================== */

/** §38 — who, when, what changed. Append-only, polymorphic by design. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    /** Changed fields only, not whole rows. */
    before: jsonb("before"),
    after: jsonb("after"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ipHash: text("ip_hash"),
    ...appendOnlyStamps,
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId, t.occurredAt.desc()),
    index("audit_log_actor_idx").on(t.actorUserId),
  ],
);

/** §4 — reversible for 30 days. The source row survives with mergedIntoId set. */
export const merges = pgTable(
  "merges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: mergeEntityType("entity_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    targetId: uuid("target_id").notNull(),
    /** Every FK that was repointed, so reversal is exact. */
    snapshot: jsonb("snapshot").notNull(),
    performedBy: uuid("performed_by").references(() => users.id, { onDelete: "set null" }),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
    reversedBy: uuid("reversed_by").references(() => users.id, { onDelete: "set null" }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    ...appendOnlyStamps,
  },
  (t) => [index("merges_entity_idx").on(t.entityType, t.sourceId)],
);

/** §39 — the audited exception to "never delete". */
export const erasures = pgTable(
  "erasures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    /** Field NAMES only. Storing the erased values would defeat the purpose. */
    fieldsCleared: jsonb("fields_cleared").notNull(),
    reason: text("reason"),
    performedBy: uuid("performed_by").references(() => users.id, { onDelete: "set null" }),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
    ...appendOnlyStamps,
  },
  (t) => [index("erasures_person_idx").on(t.personId)],
);

/** §27 suggestion thresholds and global switches. Super Admin only. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  ...stamps,
});

/* ==========================================================================
   RELATIONS — for Drizzle's relational query API
   ========================================================================== */

export const usersRelations = relations(users, ({ many }) => ({
  functions: many(userFunctions),
  eventScopes: many(userEventScopes),
  targets: many(targets),
  commissionEntries: many(commissionEntries),
}));

export const userFunctionsRelations = relations(userFunctions, ({ one }) => ({
  user: one(users, { fields: [userFunctions.userId], references: [users.id] }),
}));

export const userEventScopesRelations = relations(userEventScopes, ({ one }) => ({
  user: one(users, { fields: [userEventScopes.userId], references: [users.id] }),
  event: one(events, { fields: [userEventScopes.eventId], references: [events.id] }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  editions: many(editions),
}));

export const editionsRelations = relations(editions, ({ one, many }) => ({
  event: one(events, { fields: [editions.eventId], references: [events.id] }),
  opportunities: many(opportunities),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  domains: many(companyDomains),
  people: many(people),
  opportunities: many(opportunities),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  company: one(companies, { fields: [people.companyId], references: [companies.id] }),
  emails: many(personEmails),
  opportunities: many(opportunities),
}));

export const personEmailsRelations = relations(personEmails, ({ one }) => ({
  person: one(people, { fields: [personEmails.personId], references: [people.id] }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  person: one(people, { fields: [opportunities.personId], references: [people.id] }),
  company: one(companies, { fields: [opportunities.companyId], references: [companies.id] }),
  edition: one(editions, { fields: [opportunities.editionId], references: [editions.id] }),
  owner: one(users, { fields: [opportunities.ownerId], references: [users.id] }),
  activities: many(activities),
  commissionEntries: many(commissionEntries),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [activities.opportunityId],
    references: [opportunities.id],
  }),
  user: one(users, { fields: [activities.userId], references: [users.id] }),
}));

export const commissionEntriesRelations = relations(commissionEntries, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [commissionEntries.opportunityId],
    references: [opportunities.id],
  }),
  user: one(users, { fields: [commissionEntries.userId], references: [users.id] }),
  rule: one(commissionRules, {
    fields: [commissionEntries.ruleId],
    references: [commissionRules.id],
  }),
}));

/** Every application table. The RLS migration iterates this list, so a new
    table cannot be added without also being locked down. */
export const APPLICATION_TABLES = [
  "users",
  "user_functions",
  "user_event_scopes",
  "invitations",
  "events",
  "editions",
  "companies",
  "company_domains",
  "people",
  "person_emails",
  "pipeline_stages",
  "loss_reasons",
  "opportunities",
  "activities",
  "form_submissions",
  "targets",
  "commission_rules",
  "commission_rule_tiers",
  "commission_entries",
  "audit_log",
  "merges",
  "erasures",
  "settings",
] as const;
