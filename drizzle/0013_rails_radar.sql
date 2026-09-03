-- ============================================================================
-- RAILS RADAR — the schema, and the public read boundary.
--
-- Radar is a second product in the same database. It is a PUBLIC, crawlable
-- dataset; the CRM in `public` is the opposite. Rather than reconcile two
-- postures in one namespace, Radar gets its own schema and its own boundary.
--
-- WHAT IS PRESERVED EXACTLY, and why this migration is shaped the way it is:
--
--   drizzle/0001  RLS on, DEFAULT DENY, NOT ONE POLICY. Radar keeps this.
--   drizzle/0003  asserts anon holds NO table privilege in `public`, on every
--                 deploy. Radar is not in `public`, so that stays untouched.
--   rls-coverage  asserts CREATE POLICY appears in no migration. None here.
--
-- SO HOW IS ANYTHING PUBLIC? Through VIEWS, not policies.
--
-- Every public read goes through a view that hardcodes `status = 'published'`
-- into its own definition. anon is granted SELECT on the views and on NOTHING
-- else — the base tables carry no grant at all, and RLS is enabled on them with
-- no policy, so a direct read of a base table fails twice over.
--
-- WHY A VIEW IS THE STRONGER TOOL HERE. A policy is a predicate that has to be
-- written correctly and can be written permissively; `USING (true)` is one
-- keystroke from `USING (status = 'published')` and reviews the same. A view
-- cannot return a row its own SELECT list does not produce. The filter is the
-- object, not a rule attached to the object.
--
-- Views are deliberately left at the Postgres default `security_invoker = off`.
-- The view executes as its owner, who is exempt from RLS on the base tables, so
-- the view returns published rows to a caller who can reach nothing directly.
-- Setting security_invoker = on would make every view return zero rows to anon.
-- That is the intended design, not an oversight.
--
-- The application does NOT read through these views. It connects as the table
-- owner and applies its own hardcoded published filter in
-- src/server/radar/public.ts. Both, not either — and stated honestly: for the
-- application path the filter in that module is the control, exactly as
-- scopedQuery is the control for the CRM. The views are what close the
-- PostgREST/anon surface that ships with every Supabase project.
-- ============================================================================

/* drizzle-kit does not emit this for a pgSchema; without it every statement
   below fails on an unknown schema. */
CREATE SCHEMA IF NOT EXISTS "radar";
--> statement-breakpoint

CREATE TYPE "radar"."radar_provider_type" AS ENUM('bank', 'psp', 'orchestration', 'stablecoin', 'fx', 'custodian', 'exchange', 'onramp');--> statement-breakpoint
CREATE TYPE "radar"."radar_rail_category" AS ENUM('traditional', 'digital', 'blockchain', 'emerging');--> statement-breakpoint
CREATE TYPE "radar"."radar_route_type" AS ENUM('bank', 'local', 'stablecoin', 'hybrid');--> statement-breakpoint
CREATE TYPE "radar"."radar_source_type" AS ENUM('provider_docs', 'regulator_register', 'provider_confirmed', 'contributed');--> statement-breakpoint
CREATE TYPE "radar"."radar_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "radar"."radar_submission_kind" AS ENUM('source', 'inaccuracy');--> statement-breakpoint
CREATE TYPE "radar"."radar_submission_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "radar"."radar_corridor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corridor_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"description" text NOT NULL,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "radar_corridor_events_source_present" CHECK (btrim("radar"."radar_corridor_events"."source_url") <> '')
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_corridors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"origin_country" text NOT NULL,
	"origin_country_code" text NOT NULL,
	"origin_currency" text NOT NULL,
	"destination_country" text NOT NULL,
	"destination_country_code" text NOT NULL,
	"destination_currency" text NOT NULL,
	"destination_constraints" text,
	"destination_constraints_source_url" text,
	"status" "radar"."radar_status" DEFAULT 'draft' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_verified_by" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "radar_corridors_constraints_sourced" CHECK ("radar"."radar_corridors"."destination_constraints" IS NULL OR btrim(coalesce("radar"."radar_corridors"."destination_constraints_source_url", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_licences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" text NOT NULL,
	"register_url" text NOT NULL,
	"jurisdiction" text,
	"reference_number" text,
	"last_verified_at" timestamp with time zone,
	"last_verified_by" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "radar_licences_register_url_present" CHECK (btrim("radar"."radar_licences"."register_url") <> '')
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_provider_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"asset" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_provider_markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"market" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_provider_networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"network" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_provider_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"requirement" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_provider_use_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"use_case" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "radar"."radar_provider_type" NOT NULL,
	"logo" text,
	"website" text,
	"description" text,
	"custody_model" text,
	"api_type" text,
	"api_documentation" text,
	"settlement_time" text,
	"settlement_time_source_url" text,
	"settlement_time_source_type" "radar"."radar_source_type",
	"settlement_time_verified_at" timestamp with time zone,
	"settlement_time_verified_by" text,
	"settlement_hours" text,
	"settlement_hours_source_url" text,
	"settlement_hours_source_type" "radar"."radar_source_type",
	"settlement_hours_verified_at" timestamp with time zone,
	"settlement_hours_verified_by" text,
	"settlement_fee" text,
	"settlement_fee_source_url" text,
	"settlement_fee_source_type" "radar"."radar_source_type",
	"settlement_fee_verified_at" timestamp with time zone,
	"settlement_fee_verified_by" text,
	"limits" text,
	"limits_source_url" text,
	"limits_source_type" "radar"."radar_source_type",
	"limits_verified_at" timestamp with time zone,
	"limits_verified_by" text,
	"status" "radar"."radar_status" DEFAULT 'draft' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_verified_by" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "radar_providers_settlement_time_sourced" CHECK ("radar"."radar_providers"."settlement_time" IS NULL OR btrim(coalesce("radar"."radar_providers"."settlement_time_source_url", '')) <> ''),
	CONSTRAINT "radar_providers_settlement_hours_sourced" CHECK ("radar"."radar_providers"."settlement_hours" IS NULL OR btrim(coalesce("radar"."radar_providers"."settlement_hours_source_url", '')) <> ''),
	CONSTRAINT "radar_providers_settlement_fee_sourced" CHECK ("radar"."radar_providers"."settlement_fee" IS NULL OR btrim(coalesce("radar"."radar_providers"."settlement_fee_source_url", '')) <> ''),
	CONSTRAINT "radar_providers_limits_sourced" CHECK ("radar"."radar_providers"."limits" IS NULL OR btrim(coalesce("radar"."radar_providers"."limits_source_url", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_rails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "radar"."radar_rail_category" NOT NULL,
	"description" text,
	"icon" text,
	"is_messaging_network" boolean DEFAULT false NOT NULL,
	"status" "radar"."radar_status" DEFAULT 'draft' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_verified_by" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_route_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"asset" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_route_networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"network" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_route_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"requirement" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corridor_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"rail_id" uuid NOT NULL,
	"type" "radar"."radar_route_type" NOT NULL,
	"limit_min" numeric(20, 2),
	"limit_min_source_url" text,
	"limit_min_source_type" "radar"."radar_source_type",
	"limit_min_verified_at" timestamp with time zone,
	"limit_min_verified_by" text,
	"limit_max" numeric(20, 2),
	"limit_max_source_url" text,
	"limit_max_source_type" "radar"."radar_source_type",
	"limit_max_verified_at" timestamp with time zone,
	"limit_max_verified_by" text,
	"limit_currency" text,
	"settlement_finality" text,
	"settlement_system" text,
	"settlement_finality_source_url" text,
	"settlement_finality_source_type" "radar"."radar_source_type",
	"settlement_finality_verified_at" timestamp with time zone,
	"settlement_finality_verified_by" text,
	"operating_hours" text,
	"operating_hours_source_url" text,
	"operating_hours_source_type" "radar"."radar_source_type",
	"operating_hours_verified_at" timestamp with time zone,
	"operating_hours_verified_by" text,
	"cut_off" text,
	"cut_off_source_url" text,
	"cut_off_source_type" "radar"."radar_source_type",
	"cut_off_verified_at" timestamp with time zone,
	"cut_off_verified_by" text,
	"status" "radar"."radar_status" DEFAULT 'draft' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_verified_by" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "radar_routes_limit_min_sourced" CHECK ("radar"."radar_routes"."limit_min" IS NULL OR btrim(coalesce("radar"."radar_routes"."limit_min_source_url", '')) <> ''),
	CONSTRAINT "radar_routes_limit_max_sourced" CHECK ("radar"."radar_routes"."limit_max" IS NULL OR btrim(coalesce("radar"."radar_routes"."limit_max_source_url", '')) <> ''),
	CONSTRAINT "radar_routes_limit_currency_present" CHECK (("radar"."radar_routes"."limit_min" IS NULL AND "radar"."radar_routes"."limit_max" IS NULL) OR btrim(coalesce("radar"."radar_routes"."limit_currency", '')) <> ''),
	CONSTRAINT "radar_routes_finality_sourced" CHECK ("radar"."radar_routes"."settlement_finality" IS NULL OR btrim(coalesce("radar"."radar_routes"."settlement_finality_source_url", '')) <> ''),
	CONSTRAINT "radar_routes_hours_sourced" CHECK ("radar"."radar_routes"."operating_hours" IS NULL OR btrim(coalesce("radar"."radar_routes"."operating_hours_source_url", '')) <> ''),
	CONSTRAINT "radar_routes_cut_off_sourced" CHECK ("radar"."radar_routes"."cut_off" IS NULL OR btrim(coalesce("radar"."radar_routes"."cut_off_source_url", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "radar"."radar_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "radar"."radar_submission_kind" NOT NULL,
	"corridor_id" uuid,
	"route_id" uuid,
	"provider_id" uuid,
	"rail_id" uuid,
	"subject_note" text,
	"claimed_source_url" text,
	"submitter_email" text NOT NULL,
	"message" text,
	"status" "radar"."radar_submission_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"review_note" text,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "radar"."radar_corridor_events" ADD CONSTRAINT "radar_corridor_events_corridor_id_radar_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "radar"."radar_corridors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_licences" ADD CONSTRAINT "radar_licences_provider_id_radar_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "radar"."radar_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_assets" ADD CONSTRAINT "radar_provider_assets_provider_id_radar_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "radar"."radar_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_markets" ADD CONSTRAINT "radar_provider_markets_provider_id_radar_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "radar"."radar_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_networks" ADD CONSTRAINT "radar_provider_networks_provider_id_radar_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "radar"."radar_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_requirements" ADD CONSTRAINT "radar_provider_requirements_provider_id_radar_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "radar"."radar_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_use_cases" ADD CONSTRAINT "radar_provider_use_cases_provider_id_radar_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "radar"."radar_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_route_assets" ADD CONSTRAINT "radar_route_assets_route_id_radar_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "radar"."radar_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_route_networks" ADD CONSTRAINT "radar_route_networks_route_id_radar_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "radar"."radar_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_route_requirements" ADD CONSTRAINT "radar_route_requirements_route_id_radar_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "radar"."radar_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_routes" ADD CONSTRAINT "radar_routes_corridor_id_radar_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "radar"."radar_corridors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_routes" ADD CONSTRAINT "radar_routes_provider_id_radar_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "radar"."radar_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_routes" ADD CONSTRAINT "radar_routes_rail_id_radar_rails_id_fk" FOREIGN KEY ("rail_id") REFERENCES "radar"."radar_rails"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_submissions" ADD CONSTRAINT "radar_submissions_corridor_id_radar_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "radar"."radar_corridors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_submissions" ADD CONSTRAINT "radar_submissions_route_id_radar_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "radar"."radar_routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_submissions" ADD CONSTRAINT "radar_submissions_provider_id_radar_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "radar"."radar_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar"."radar_submissions" ADD CONSTRAINT "radar_submissions_rail_id_radar_rails_id_fk" FOREIGN KEY ("rail_id") REFERENCES "radar"."radar_rails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "radar_corridor_events_corridor_idx" ON "radar"."radar_corridor_events" USING btree ("corridor_id","occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_corridors_slug_key" ON "radar"."radar_corridors" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_corridors_pair_key" ON "radar"."radar_corridors" USING btree ("origin_country_code","origin_currency","destination_country_code","destination_currency");--> statement-breakpoint
CREATE INDEX "radar_corridors_status_idx" ON "radar"."radar_corridors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "radar_licences_provider_idx" ON "radar"."radar_licences" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_provider_assets_key" ON "radar"."radar_provider_assets" USING btree ("provider_id","asset");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_provider_markets_key" ON "radar"."radar_provider_markets" USING btree ("provider_id","market");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_provider_networks_key" ON "radar"."radar_provider_networks" USING btree ("provider_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_provider_requirements_key" ON "radar"."radar_provider_requirements" USING btree ("provider_id","requirement");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_provider_use_cases_key" ON "radar"."radar_provider_use_cases" USING btree ("provider_id","use_case");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_providers_slug_key" ON "radar"."radar_providers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "radar_providers_status_idx" ON "radar"."radar_providers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_rails_slug_key" ON "radar"."radar_rails" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "radar_rails_status_idx" ON "radar"."radar_rails" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_route_assets_key" ON "radar"."radar_route_assets" USING btree ("route_id","asset");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_route_networks_key" ON "radar"."radar_route_networks" USING btree ("route_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_route_requirements_key" ON "radar"."radar_route_requirements" USING btree ("route_id","requirement");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_routes_key" ON "radar"."radar_routes" USING btree ("corridor_id","provider_id","rail_id");--> statement-breakpoint
CREATE INDEX "radar_routes_corridor_idx" ON "radar"."radar_routes" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "radar_routes_provider_idx" ON "radar"."radar_routes" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "radar_routes_rail_idx" ON "radar"."radar_routes" USING btree ("rail_id");--> statement-breakpoint
CREATE INDEX "radar_routes_status_idx" ON "radar"."radar_routes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "radar_submissions_status_idx" ON "radar"."radar_submissions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "radar_submissions_ip_idx" ON "radar"."radar_submissions" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "radar_submissions_corridor_idx" ON "radar"."radar_submissions" USING btree ("corridor_id");

--> statement-breakpoint

-- ============================================================================
-- RLS — ON EVERYWHERE, NO POLICIES. Identical in design to drizzle/0001.
--
-- With RLS enabled and no policy, every non-owner role reads zero rows. The
-- application is the table owner and is exempt, which is the honest description
-- of the model: RLS closes the anon/PostgREST surface; the hardcoded filter in
-- src/server/radar/public.ts governs the application path.
-- ============================================================================

ALTER TABLE "radar"."radar_rails"                 ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_providers"             ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_markets"      ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_assets"       ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_networks"     ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_use_cases"    ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_provider_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_licences"              ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_corridors"             ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_corridor_events"       ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_routes"                ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_route_assets"          ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_route_networks"        ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_route_requirements"    ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar"."radar_submissions"           ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Base tables carry no grant. Ever. Including tables added later.
REVOKE ALL ON ALL TABLES IN SCHEMA "radar" FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "radar" REVOKE ALL ON TABLES FROM anon, authenticated;--> statement-breakpoint

-- ============================================================================
-- THE PUBLIC SURFACE — published rows only, and only through these views.
--
-- Every view hardcodes its own filter. A route is visible only when the route,
-- its corridor, its provider AND its rail are all published: a published route
-- attached to a draft provider would otherwise leak that provider's name.
--
-- radar_submissions has NO view and never will. A submission is an unverified
-- claim from the open internet; it is not data, and it does not render.
-- ============================================================================

CREATE VIEW "radar"."v_rails" AS
  SELECT id, slug, name, category, description, icon, is_messaging_network,
         last_verified_at, last_verified_by, source_url
  FROM "radar"."radar_rails"
  WHERE status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_providers" AS
  SELECT id, slug, name, type, logo, website, description, custody_model,
         api_type, api_documentation,
         settlement_time, settlement_time_source_url, settlement_time_source_type,
         settlement_time_verified_at, settlement_time_verified_by,
         settlement_hours, settlement_hours_source_url, settlement_hours_source_type,
         settlement_hours_verified_at, settlement_hours_verified_by,
         settlement_fee, settlement_fee_source_url, settlement_fee_source_type,
         settlement_fee_verified_at, settlement_fee_verified_by,
         limits, limits_source_url, limits_source_type,
         limits_verified_at, limits_verified_by,
         last_verified_at, last_verified_by, source_url
  FROM "radar"."radar_providers"
  WHERE status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_licences" AS
  SELECT l.id, l.provider_id, l.name, l.register_url, l.jurisdiction,
         l.reference_number, l.last_verified_at, l.last_verified_by, l.source_url
  FROM "radar"."radar_licences" l
  JOIN "radar"."radar_providers" p ON p.id = l.provider_id
  WHERE p.status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_provider_markets" AS
  SELECT m.id, m.provider_id, m.market FROM "radar"."radar_provider_markets" m
  JOIN "radar"."radar_providers" p ON p.id = m.provider_id WHERE p.status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_provider_assets" AS
  SELECT a.id, a.provider_id, a.asset FROM "radar"."radar_provider_assets" a
  JOIN "radar"."radar_providers" p ON p.id = a.provider_id WHERE p.status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_provider_networks" AS
  SELECT n.id, n.provider_id, n.network FROM "radar"."radar_provider_networks" n
  JOIN "radar"."radar_providers" p ON p.id = n.provider_id WHERE p.status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_provider_use_cases" AS
  SELECT u.id, u.provider_id, u.use_case FROM "radar"."radar_provider_use_cases" u
  JOIN "radar"."radar_providers" p ON p.id = u.provider_id WHERE p.status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_provider_requirements" AS
  SELECT r.id, r.provider_id, r.requirement FROM "radar"."radar_provider_requirements" r
  JOIN "radar"."radar_providers" p ON p.id = r.provider_id WHERE p.status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_corridors" AS
  SELECT id, slug, origin_country, origin_country_code, origin_currency,
         destination_country, destination_country_code, destination_currency,
         destination_constraints, destination_constraints_source_url,
         last_verified_at, last_verified_by, source_url, updated_at
  FROM "radar"."radar_corridors"
  WHERE status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_corridor_events" AS
  SELECT e.id, e.corridor_id, e.occurred_on, e.description, e.source_url
  FROM "radar"."radar_corridor_events" e
  JOIN "radar"."radar_corridors" c ON c.id = e.corridor_id
  WHERE c.status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_routes" AS
  SELECT r.id, r.corridor_id, r.provider_id, r.rail_id, r.type,
         r.limit_min, r.limit_min_source_url, r.limit_min_source_type,
         r.limit_min_verified_at, r.limit_min_verified_by,
         r.limit_max, r.limit_max_source_url, r.limit_max_source_type,
         r.limit_max_verified_at, r.limit_max_verified_by,
         r.limit_currency,
         r.settlement_finality, r.settlement_system,
         r.settlement_finality_source_url, r.settlement_finality_source_type,
         r.settlement_finality_verified_at, r.settlement_finality_verified_by,
         r.operating_hours, r.operating_hours_source_url, r.operating_hours_source_type,
         r.operating_hours_verified_at, r.operating_hours_verified_by,
         r.cut_off, r.cut_off_source_url, r.cut_off_source_type,
         r.cut_off_verified_at, r.cut_off_verified_by,
         r.last_verified_at, r.last_verified_by, r.source_url
  FROM "radar"."radar_routes" r
  JOIN "radar"."radar_corridors" c ON c.id = r.corridor_id
  JOIN "radar"."radar_providers" p ON p.id = r.provider_id
  JOIN "radar"."radar_rails"     l ON l.id = r.rail_id
  WHERE r.status = 'published'
    AND c.status = 'published'
    AND p.status = 'published'
    AND l.status = 'published';--> statement-breakpoint

CREATE VIEW "radar"."v_route_assets" AS
  SELECT a.id, a.route_id, a.asset FROM "radar"."radar_route_assets" a
  JOIN "radar"."v_routes" v ON v.id = a.route_id;--> statement-breakpoint

CREATE VIEW "radar"."v_route_networks" AS
  SELECT n.id, n.route_id, n.network FROM "radar"."radar_route_networks" n
  JOIN "radar"."v_routes" v ON v.id = n.route_id;--> statement-breakpoint

CREATE VIEW "radar"."v_route_requirements" AS
  SELECT q.id, q.route_id, q.requirement FROM "radar"."radar_route_requirements" q
  JOIN "radar"."v_routes" v ON v.id = q.route_id;--> statement-breakpoint

-- Name resolution only. Without a table privilege this permits nothing —
-- the same reasoning drizzle/0003 sets out for PUBLIC's usage on `public`.
GRANT USAGE ON SCHEMA "radar" TO anon, authenticated;--> statement-breakpoint

GRANT SELECT ON
  "radar"."v_rails", "radar"."v_providers", "radar"."v_licences",
  "radar"."v_provider_markets", "radar"."v_provider_assets",
  "radar"."v_provider_networks", "radar"."v_provider_use_cases",
  "radar"."v_provider_requirements", "radar"."v_corridors",
  "radar"."v_corridor_events", "radar"."v_routes", "radar"."v_route_assets",
  "radar"."v_route_networks", "radar"."v_route_requirements"
TO anon, authenticated;--> statement-breakpoint

-- ============================================================================
-- ASSERT THE OUTCOME. Same discipline as 0001 and 0003 — the guarantee is
-- verified by Postgres on every deploy, not trusted to review.
-- ============================================================================

DO $$
DECLARE
  unprotected text;
  leaked      text;
  policies    int;
BEGIN
  -- 1. RLS on, every base table in the schema.
  SELECT string_agg(c.relname, ', ') INTO unprotected
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'radar' AND c.relkind = 'r' AND c.relrowsecurity = false;

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'radar tables without RLS: %', unprotected;
  END IF;

  -- 2. No policies. Deny by omission, exactly as in public.
  SELECT count(*) INTO policies
  FROM pg_policies WHERE schemaname = 'radar';

  IF policies > 0 THEN
    RAISE EXCEPTION 'radar must have no RLS policies; found %. Public read goes through published-only views.', policies;
  END IF;

  -- 3. anon reaches NO base table. Views only, or the boundary is not a boundary.
  SELECT string_agg(DISTINCT g.grantee || ' -> ' || g.table_name, ', ') INTO leaked
  FROM information_schema.role_table_grants g
  JOIN pg_class c ON c.relname = g.table_name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'radar'
  WHERE g.table_schema = 'radar'
    AND g.grantee IN ('anon', 'authenticated')
    AND c.relkind = 'r';

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'anon/authenticated hold privileges on radar BASE tables: %. Only the published-only views may be granted.', leaked;
  END IF;

  -- 4. The submissions table is never readable, by anyone but the owner.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'radar' AND table_name = 'radar_submissions'
      AND grantee IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'radar_submissions is unverified public input and must never carry a grant.';
  END IF;
END $$;
