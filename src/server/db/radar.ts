/**
 * RAILS RADAR — the data model, as Drizzle schema.
 *
 * Kept in its own file rather than folded into schema.ts because Radar is a
 * separate product sharing one database. Nothing here references a CRM table
 * and nothing in schema.ts references anything here; the two graphs are
 * disjoint, which is what lets the public read module in
 * src/server/radar/public.ts be narrow by construction rather than by promise.
 *
 * PROVENANCE IS PART OF THE TYPE. No figure in this schema is a bare value.
 * Every one carries `_source_url`, `_source_type`, `_verified_at` and
 * `_verified_by` alongside it, and a CHECK constraint makes a value without a
 * source physically unstorable:
 *
 *     value IS NULL OR btrim(source_url) <> ''
 *
 * That is the spec's "a non-null value with an empty sourceUrl is a type
 * error" moved down a layer, where it cannot be forgotten by a caller. The
 * renderer's job is then trivial: a null value prints "Not published". It
 * never computes, interpolates or infers a substitute.
 *
 * NO ARRAY COLUMNS. src/server/db/client.ts runs the pooler with
 * `fetch_types: false`, which is only safe while no column in the database is
 * an array type — postgres.js would otherwise need a catalog round trip that
 * races the pooler and hangs the request. So every multi-value field here
 * (assets, networks, markets, requirements) is a child table. This is a hard
 * constraint, not a style preference.
 *
 * WHAT IS DELIBERATELY ABSENT: cost and settlement time as first-class route
 * columns. V1 ships the map, not the meter. Provider-level settlement figures
 * exist only because providers sometimes publish them, and they are sourced
 * like everything else. There is no scoring column, no rank, no rating — the
 * Decisions layer is future work and the schema reserves nothing for it.
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * THE `radar` SCHEMA — the boundary, expressed in Postgres rather than in
 * convention.
 *
 * Radar does not live in `public`, and that is load-bearing in three ways:
 *
 *   1. `public` is where the CRM lives. Two disjoint products sharing one
 *      namespace is how a join between them eventually gets written by
 *      accident. Here it cannot even be named without qualifying it.
 *
 *   2. drizzle/0003 asserts, on every deploy, that anon and authenticated hold
 *      NO table privilege in `public`. Radar's data is public and needs a read
 *      grant. Putting it in `public` would force that assertion to be weakened;
 *      putting it here leaves it exactly as strict as it was.
 *
 *   3. The CRM's design is default-deny with NO policies at all, asserted by
 *      src/server/test/rls-coverage.test.ts. Radar keeps that same design —
 *      RLS on, zero policies — and grants public read through published-only
 *      VIEWS instead. See the migration for why a view is the stronger tool.
 */
const radarSchema = pgSchema("radar");

/* ---------------------------------------------------------------------- enums */

export const radarRailCategory = radarSchema.enum("radar_rail_category", [
  "traditional",
  "digital",
  "blockchain",
  "emerging",
]);

export const radarProviderType = radarSchema.enum("radar_provider_type", [
  "bank",
  "psp",
  "orchestration",
  "stablecoin",
  "fx",
  "custodian",
  "exchange",
  "onramp",
]);

export const radarRouteType = radarSchema.enum("radar_route_type", [
  "bank",
  "local",
  "stablecoin",
  "hybrid",
]);

/**
 * The publication gate. `published` is the ONLY value the public read module
 * will return, and it applies that filter as a hardcoded literal — never as a
 * parameter a caller could widen.
 */
export const radarStatus = radarSchema.enum("radar_status", ["draft", "published", "archived"]);

/** Where a figure came from. Contributed data is never published unreviewed. */
export const radarSourceType = radarSchema.enum("radar_source_type", [
  "provider_docs",
  "regulator_register",
  "provider_confirmed",
  "contributed",
]);

export const radarSubmissionKind = radarSchema.enum("radar_submission_kind", [
  "source",
  "inaccuracy",
]);

export const radarSubmissionStatus = radarSchema.enum("radar_submission_status", [
  "pending",
  "accepted",
  "rejected",
]);

/* --------------------------------------------------------------------- stamps */

const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
};

/**
 * Record-level verification. There is NO global "verified today" badge in this
 * product — the claim is false the moment one row goes stale — so every
 * publishable record carries its own stamp and the UI prints it per card.
 */
const verification = {
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  /** Who checked it. A name or handle, not a foreign key: the verifier may be
      an editor who no longer has an account, and the audit value is the name. */
  lastVerifiedBy: text("last_verified_by"),
  sourceUrl: text("source_url"),
};

/* ==========================================================================
   RAILS — every way money can move.
   ========================================================================== */

export const radarRails = radarSchema.table(
  "radar_rails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: radarRailCategory("category").notNull(),
    description: text("description"),
    /** Lucide/Heroicons outline icon name. Never an emoji. */
    icon: text("icon"),
    /**
     * THE ONTOLOGICAL DISTINCTION, encoded rather than described.
     *
     * SWIFT carries instructions; it does not settle. A rail with this flag set
     * must never have settlement finality attributed to it — finality belongs
     * to the settlement system underneath, and the renderer reads this column
     * to decide whether to show a finality field at all.
     */
    isMessagingNetwork: boolean("is_messaging_network").notNull().default(false),
    status: radarStatus("status").notNull().default("draft"),
    ...verification,
    ...stamps,
  },
  (t) => [
    uniqueIndex("radar_rails_slug_key").on(t.slug),
    index("radar_rails_status_idx").on(t.status),
  ],
);

/* ==========================================================================
   PROVIDERS — who gives you access to the rail.
   ========================================================================== */

export const radarProviders = radarSchema.table(
  "radar_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    type: radarProviderType("type").notNull(),
    logo: text("logo"),
    website: text("website"),
    description: text("description"),
    custodyModel: text("custody_model"),
    apiType: text("api_type"),
    apiDocumentation: text("api_documentation"),

    /* ---- settlement, sourced. Present only where the provider publishes it ---- */
    settlementTime: text("settlement_time"),
    settlementTimeSourceUrl: text("settlement_time_source_url"),
    settlementTimeSourceType: radarSourceType("settlement_time_source_type"),
    settlementTimeVerifiedAt: timestamp("settlement_time_verified_at", { withTimezone: true }),
    settlementTimeVerifiedBy: text("settlement_time_verified_by"),

    settlementHours: text("settlement_hours"),
    settlementHoursSourceUrl: text("settlement_hours_source_url"),
    settlementHoursSourceType: radarSourceType("settlement_hours_source_type"),
    settlementHoursVerifiedAt: timestamp("settlement_hours_verified_at", { withTimezone: true }),
    settlementHoursVerifiedBy: text("settlement_hours_verified_by"),

    settlementFee: text("settlement_fee"),
    settlementFeeSourceUrl: text("settlement_fee_source_url"),
    settlementFeeSourceType: radarSourceType("settlement_fee_source_type"),
    settlementFeeVerifiedAt: timestamp("settlement_fee_verified_at", { withTimezone: true }),
    settlementFeeVerifiedBy: text("settlement_fee_verified_by"),

    limits: text("limits"),
    limitsSourceUrl: text("limits_source_url"),
    limitsSourceType: radarSourceType("limits_source_type"),
    limitsVerifiedAt: timestamp("limits_verified_at", { withTimezone: true }),
    limitsVerifiedBy: text("limits_verified_by"),

    status: radarStatus("status").notNull().default("draft"),
    ...verification,
    ...stamps,
  },
  (t) => [
    uniqueIndex("radar_providers_slug_key").on(t.slug),
    index("radar_providers_status_idx").on(t.status),
    check(
      "radar_providers_settlement_time_sourced",
      sql`${t.settlementTime} IS NULL OR btrim(coalesce(${t.settlementTimeSourceUrl}, '')) <> ''`,
    ),
    check(
      "radar_providers_settlement_hours_sourced",
      sql`${t.settlementHours} IS NULL OR btrim(coalesce(${t.settlementHoursSourceUrl}, '')) <> ''`,
    ),
    check(
      "radar_providers_settlement_fee_sourced",
      sql`${t.settlementFee} IS NULL OR btrim(coalesce(${t.settlementFeeSourceUrl}, '')) <> ''`,
    ),
    check(
      "radar_providers_limits_sourced",
      sql`${t.limits} IS NULL OR btrim(coalesce(${t.limitsSourceUrl}, '')) <> ''`,
    ),
  ],
);

/** Multi-value provider attributes. Child tables, never arrays — see the file header. */
export const radarProviderMarkets = radarSchema.table(
  "radar_provider_markets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => radarProviders.id, { onDelete: "cascade" }),
    market: text("market").notNull(),
  },
  (t) => [uniqueIndex("radar_provider_markets_key").on(t.providerId, t.market)],
);

export const radarProviderAssets = radarSchema.table(
  "radar_provider_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => radarProviders.id, { onDelete: "cascade" }),
    asset: text("asset").notNull(),
  },
  (t) => [uniqueIndex("radar_provider_assets_key").on(t.providerId, t.asset)],
);

export const radarProviderNetworks = radarSchema.table(
  "radar_provider_networks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => radarProviders.id, { onDelete: "cascade" }),
    network: text("network").notNull(),
  },
  (t) => [uniqueIndex("radar_provider_networks_key").on(t.providerId, t.network)],
);

export const radarProviderUseCases = radarSchema.table(
  "radar_provider_use_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => radarProviders.id, { onDelete: "cascade" }),
    useCase: text("use_case").notNull(),
  },
  (t) => [uniqueIndex("radar_provider_use_cases_key").on(t.providerId, t.useCase)],
);

export const radarProviderRequirements = radarSchema.table(
  "radar_provider_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => radarProviders.id, { onDelete: "cascade" }),
    requirement: text("requirement").notNull(),
  },
  (t) => [uniqueIndex("radar_provider_requirements_key").on(t.providerId, t.requirement)],
);

/**
 * LICENCES. `registerUrl` is NOT NULL and CHECKed non-empty.
 *
 * A licence claim without the register it appears on is an assertion about a
 * real, named company's regulatory standing that nobody can check. That is the
 * one category of error here with legal consequences, so the database refuses
 * to store it rather than trusting every future caller to remember.
 */
export const radarLicences = radarSchema.table(
  "radar_licences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => radarProviders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    registerUrl: text("register_url").notNull(),
    jurisdiction: text("jurisdiction"),
    /** The regulator's own reference, where one is published. */
    referenceNumber: text("reference_number"),
    ...verification,
    ...stamps,
  },
  (t) => [
    index("radar_licences_provider_idx").on(t.providerId),
    check("radar_licences_register_url_present", sql`btrim(${t.registerUrl}) <> ''`),
  ],
);

/* ==========================================================================
   CORRIDORS — money movement paths. The distribution layer.
   ========================================================================== */

export const radarCorridors = radarSchema.table(
  "radar_corridors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** `us-to-brazil`. The URL is the identity — it must never be regenerated
        for an existing corridor or every inbound link to it dies. */
    slug: text("slug").notNull(),
    originCountry: text("origin_country").notNull(),
    originCountryCode: text("origin_country_code").notNull(),
    originCurrency: text("origin_currency").notNull(),
    destinationCountry: text("destination_country").notNull(),
    destinationCountryCode: text("destination_country_code").notNull(),
    destinationCurrency: text("destination_currency").notNull(),
    /** Regulatory constraints in the destination market. Prose is allowed here
        and nowhere else — a constraint is genuinely a sentence. */
    destinationConstraints: text("destination_constraints"),
    destinationConstraintsSourceUrl: text("destination_constraints_source_url"),
    status: radarStatus("status").notNull().default("draft"),
    ...verification,
    ...stamps,
  },
  (t) => [
    uniqueIndex("radar_corridors_slug_key").on(t.slug),
    uniqueIndex("radar_corridors_pair_key").on(
      t.originCountryCode,
      t.originCurrency,
      t.destinationCountryCode,
      t.destinationCurrency,
    ),
    index("radar_corridors_status_idx").on(t.status),
    check(
      "radar_corridors_constraints_sourced",
      sql`${t.destinationConstraints} IS NULL OR btrim(coalesce(${t.destinationConstraintsSourceUrl}, '')) <> ''`,
    ),
  ],
);

/**
 * STRUCTURAL history only — a licence added, a network supported, a scheme
 * joined. Explicitly NOT cost or time history: those are not shipped in V1 and
 * a table that could hold them would eventually be filled with estimates.
 */
export const radarCorridorEvents = radarSchema.table(
  "radar_corridor_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    corridorId: uuid("corridor_id")
      .notNull()
      .references(() => radarCorridors.id, { onDelete: "cascade" }),
    occurredOn: date("occurred_on").notNull(),
    description: text("description").notNull(),
    sourceUrl: text("source_url").notNull(),
    ...stamps,
  },
  (t) => [
    index("radar_corridor_events_corridor_idx").on(t.corridorId, t.occurredOn),
    check("radar_corridor_events_source_present", sql`btrim(${t.sourceUrl}) <> ''`),
  ],
);

/* ==========================================================================
   ROUTES — a rail, reached through a provider, in a corridor.
   ========================================================================== */

export const radarRoutes = radarSchema.table(
  "radar_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    corridorId: uuid("corridor_id")
      .notNull()
      .references(() => radarCorridors.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => radarProviders.id, { onDelete: "restrict" }),
    railId: uuid("rail_id")
      .notNull()
      .references(() => radarRails.id, { onDelete: "restrict" }),
    type: radarRouteType("type").notNull(),

    /* ---- published limits. The ONLY thing `amount` filters on. ---- */
    limitMin: numeric("limit_min", { precision: 20, scale: 2 }),
    limitMinSourceUrl: text("limit_min_source_url"),
    limitMinSourceType: radarSourceType("limit_min_source_type"),
    limitMinVerifiedAt: timestamp("limit_min_verified_at", { withTimezone: true }),
    limitMinVerifiedBy: text("limit_min_verified_by"),

    limitMax: numeric("limit_max", { precision: 20, scale: 2 }),
    limitMaxSourceUrl: text("limit_max_source_url"),
    limitMaxSourceType: radarSourceType("limit_max_source_type"),
    limitMaxVerifiedAt: timestamp("limit_max_verified_at", { withTimezone: true }),
    limitMaxVerifiedBy: text("limit_max_verified_by"),

    /** The currency the limits are denominated in. A limit without one is
        meaningless, so it is CHECKed present whenever either bound is. */
    limitCurrency: text("limit_currency"),

    /**
     * SETTLEMENT FINALITY — "Irrevocable", "Net", "Gross".
     *
     * Belongs to the settlement system, never to a messaging network. Where the
     * rail is SWIFT, this describes the correspondent's settlement layer, and
     * `settlementSystem` names which system that is so the attribution is
     * legible rather than implied.
     */
    settlementFinality: text("settlement_finality"),
    settlementSystem: text("settlement_system"),
    settlementFinalitySourceUrl: text("settlement_finality_source_url"),
    settlementFinalitySourceType: radarSourceType("settlement_finality_source_type"),
    settlementFinalityVerifiedAt: timestamp("settlement_finality_verified_at", {
      withTimezone: true,
    }),
    settlementFinalityVerifiedBy: text("settlement_finality_verified_by"),

    operatingHours: text("operating_hours"),
    operatingHoursSourceUrl: text("operating_hours_source_url"),
    operatingHoursSourceType: radarSourceType("operating_hours_source_type"),
    operatingHoursVerifiedAt: timestamp("operating_hours_verified_at", { withTimezone: true }),
    operatingHoursVerifiedBy: text("operating_hours_verified_by"),

    cutOff: text("cut_off"),
    cutOffSourceUrl: text("cut_off_source_url"),
    cutOffSourceType: radarSourceType("cut_off_source_type"),
    cutOffVerifiedAt: timestamp("cut_off_verified_at", { withTimezone: true }),
    cutOffVerifiedBy: text("cut_off_verified_by"),

    status: radarStatus("status").notNull().default("draft"),
    ...verification,
    ...stamps,
  },
  (t) => [
    uniqueIndex("radar_routes_key").on(t.corridorId, t.providerId, t.railId),
    index("radar_routes_corridor_idx").on(t.corridorId),
    index("radar_routes_provider_idx").on(t.providerId),
    index("radar_routes_rail_idx").on(t.railId),
    index("radar_routes_status_idx").on(t.status),
    check(
      "radar_routes_limit_min_sourced",
      sql`${t.limitMin} IS NULL OR btrim(coalesce(${t.limitMinSourceUrl}, '')) <> ''`,
    ),
    check(
      "radar_routes_limit_max_sourced",
      sql`${t.limitMax} IS NULL OR btrim(coalesce(${t.limitMaxSourceUrl}, '')) <> ''`,
    ),
    check(
      "radar_routes_limit_currency_present",
      sql`(${t.limitMin} IS NULL AND ${t.limitMax} IS NULL) OR btrim(coalesce(${t.limitCurrency}, '')) <> ''`,
    ),
    check(
      "radar_routes_finality_sourced",
      sql`${t.settlementFinality} IS NULL OR btrim(coalesce(${t.settlementFinalitySourceUrl}, '')) <> ''`,
    ),
    check(
      "radar_routes_hours_sourced",
      sql`${t.operatingHours} IS NULL OR btrim(coalesce(${t.operatingHoursSourceUrl}, '')) <> ''`,
    ),
    check(
      "radar_routes_cut_off_sourced",
      sql`${t.cutOff} IS NULL OR btrim(coalesce(${t.cutOffSourceUrl}, '')) <> ''`,
    ),
  ],
);

export const radarRouteAssets = radarSchema.table(
  "radar_route_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => radarRoutes.id, { onDelete: "cascade" }),
    asset: text("asset").notNull(),
  },
  (t) => [uniqueIndex("radar_route_assets_key").on(t.routeId, t.asset)],
);

export const radarRouteNetworks = radarSchema.table(
  "radar_route_networks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => radarRoutes.id, { onDelete: "cascade" }),
    network: text("network").notNull(),
  },
  (t) => [uniqueIndex("radar_route_networks_key").on(t.routeId, t.network)],
);

export const radarRouteRequirements = radarSchema.table(
  "radar_route_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => radarRoutes.id, { onDelete: "cascade" }),
    requirement: text("requirement").notNull(),
  },
  (t) => [uniqueIndex("radar_route_requirements_key").on(t.routeId, t.requirement)],
);

/* ==========================================================================
   CONTRIBUTIONS — the moderation gate.
   ========================================================================== */

/**
 * "Submit a source" and "Report inaccuracy" both land here, and NOTHING here
 * is ever rendered publicly. A submission is a claim awaiting verification, not
 * data. The admin queue reads it; an editor checks the source and, if it holds,
 * writes the real record themselves. There is deliberately no code path that
 * promotes a submission into a live field automatically.
 *
 * The submitter's email is collected for verification follow-up only. It is
 * disclosed in the footer on every page that can reach this table, and it is
 * never shared with a third party.
 */
export const radarSubmissions = radarSchema.table(
  "radar_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: radarSubmissionKind("kind").notNull(),

    /* What it is about. All nullable — a source submission may name only a
       corridor, an inaccuracy report names the record it disputes. */
    corridorId: uuid("corridor_id").references(() => radarCorridors.id, { onDelete: "set null" }),
    routeId: uuid("route_id").references(() => radarRoutes.id, { onDelete: "set null" }),
    providerId: uuid("provider_id").references(() => radarProviders.id, { onDelete: "set null" }),
    railId: uuid("rail_id").references(() => radarRails.id, { onDelete: "set null" }),

    /** Which field is disputed or supplied, in the submitter's words. */
    subjectNote: text("subject_note"),
    claimedSourceUrl: text("claimed_source_url"),
    submitterEmail: text("submitter_email").notNull(),
    message: text("message"),

    status: radarSubmissionStatus("status").notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by"),
    reviewNote: text("review_note"),

    /** Hashed, never raw. A rate limit needs to recognise a repeat visitor; it
        does not need to know who they are. Mirrors src/rpc/intake.ts. */
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("radar_submissions_status_idx").on(t.status, t.createdAt),
    index("radar_submissions_ip_idx").on(t.ipHash, t.createdAt),
    index("radar_submissions_corridor_idx").on(t.corridorId),
  ],
);

/* ------------------------------------------------------------------ relations */

export const radarCorridorRelations = relations(radarCorridors, ({ many }) => ({
  routes: many(radarRoutes),
  events: many(radarCorridorEvents),
}));

export const radarRouteRelations = relations(radarRoutes, ({ one, many }) => ({
  corridor: one(radarCorridors, {
    fields: [radarRoutes.corridorId],
    references: [radarCorridors.id],
  }),
  provider: one(radarProviders, {
    fields: [radarRoutes.providerId],
    references: [radarProviders.id],
  }),
  rail: one(radarRails, { fields: [radarRoutes.railId], references: [radarRails.id] }),
  assets: many(radarRouteAssets),
  networks: many(radarRouteNetworks),
  requirements: many(radarRouteRequirements),
}));

export const radarProviderRelations = relations(radarProviders, ({ many }) => ({
  licences: many(radarLicences),
  markets: many(radarProviderMarkets),
  assets: many(radarProviderAssets),
  networks: many(radarProviderNetworks),
  useCases: many(radarProviderUseCases),
  requirements: many(radarProviderRequirements),
  routes: many(radarRoutes),
}));

export const radarLicenceRelations = relations(radarLicences, ({ one }) => ({
  provider: one(radarProviders, {
    fields: [radarLicences.providerId],
    references: [radarProviders.id],
  }),
}));
