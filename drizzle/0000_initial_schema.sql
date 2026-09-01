CREATE TYPE "public"."activity_type" AS ENUM('call', 'email', 'meeting', 'follow_up', 'note', 'proposal', 'status_change', 'assignment', 'other');--> statement-breakpoint
CREATE TYPE "public"."commission_basis" AS ENUM('percentage', 'fixed_per_deal', 'tiered');--> statement-breakpoint
CREATE TYPE "public"."commission_entry_type" AS ENUM('earned', 'adjustment', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."edition_status" AS ENUM('planning', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."form_type" AS ENUM('prospectus', 'apply');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('website', 'manual', 'import', 'referral', 'event', 'other');--> statement-breakpoint
CREATE TYPE "public"."merge_entity_type" AS ENUM('person', 'company');--> statement-breakpoint
CREATE TYPE "public"."opportunity_priority" AS ENUM('normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('processed', 'rejected_spam', 'failed');--> statement-breakpoint
CREATE TYPE "public"."target_metric" AS ENUM('revenue', 'count');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'team_member');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."work_function" AS ENUM('sponsor', 'delegate', 'speaker');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"user_id" uuid,
	"type" "activity_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
-- HAND EDIT, INTENTIONAL AND PERMANENT.
--
-- drizzle-kit emits `CREATE TABLE "auth"."users"` because schema.ts declares
-- that table so the foreign key below can be expressed. Supabase already owns
-- auth.users; creating it would fail, and creating a decoy would be worse.
-- Replaced with an assertion, so pointing these migrations at a plain Postgres
-- fails here with a readable message instead of halfway through.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'auth.users not found. Financial Rails OS requires a Supabase project; Supabase Auth owns this table.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "commission_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rule_id" uuid,
	"entry_type" "commission_entry_type" NOT NULL,
	"reverses_entry_id" uuid,
	"locked_basis" "commission_basis" NOT NULL,
	"locked_rate_pct" numeric(6, 3),
	"locked_fixed_amount" numeric(14, 2),
	"locked_tiers" jsonb,
	"base_value" numeric(14, 2) NOT NULL,
	"split_pct" integer DEFAULT 100 NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "commission_entries_reversal_link" CHECK (("commission_entries"."entry_type" = 'reversal' AND "commission_entries"."reverses_entry_id" IS NOT NULL)
       OR ("commission_entries"."entry_type" <> 'reversal' AND "commission_entries"."reverses_entry_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "commission_rule_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"min_value" numeric(14, 2) NOT NULL,
	"max_value" numeric(14, 2),
	"rate_pct" numeric(6, 3),
	"fixed_amount" numeric(14, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"function" "work_function" NOT NULL,
	"scope_event_id" uuid,
	"scope_edition_id" uuid,
	"scope_user_id" uuid,
	"basis" "commission_basis" NOT NULL,
	"rate_pct" numeric(6, 3),
	"fixed_amount" numeric(14, 2),
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "commission_rules_basis_fields" CHECK (("commission_rules"."basis" = 'percentage' AND "commission_rules"."rate_pct" IS NOT NULL)
       OR ("commission_rules"."basis" = 'fixed_per_deal' AND "commission_rules"."fixed_amount" IS NOT NULL)
       OR ("commission_rules"."basis" = 'tiered'))
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"website" text,
	"country" text,
	"merged_into_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "company_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"city" text,
	"country" text,
	"starts_on" date,
	"ends_on" date,
	"status" "edition_status" DEFAULT 'planning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "erasures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"fields_cleared" jsonb NOT NULL,
	"reason" text,
	"performed_by" uuid,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"region" text,
	"status" "event_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_type" "form_type" NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"submitted_email" text,
	"person_id" uuid,
	"opportunity_id" uuid,
	"status" "submission_status" DEFAULT 'processed' NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "loss_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"function" "work_function" NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "merge_entity_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"performed_by" uuid,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_by" uuid,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"company_id" uuid,
	"edition_id" uuid NOT NULL,
	"function" "work_function" NOT NULL,
	"stage_key" text NOT NULL,
	"owner_id" uuid,
	"secondary_owner_id" uuid,
	"owner_split_pct" integer DEFAULT 100 NOT NULL,
	"secondary_split_pct" integer DEFAULT 0 NOT NULL,
	"source" "lead_source" DEFAULT 'manual' NOT NULL,
	"priority" "opportunity_priority" DEFAULT 'normal' NOT NULL,
	"estimated_value" numeric(14, 2),
	"final_value" numeric(14, 2),
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"probability_overridden" boolean DEFAULT false NOT NULL,
	"loss_reason_key" text,
	"next_action" text,
	"next_action_due_at" timestamp with time zone,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cloned_from_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "opportunities_split_totals_100" CHECK ("opportunities"."owner_split_pct" + "opportunities"."secondary_split_pct" = 100),
	CONSTRAINT "opportunities_probability_range" CHECK ("opportunities"."probability" >= 0 AND "opportunities"."probability" <= 100)
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"full_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"job_title" text,
	"phone" text,
	"country" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"merged_into_id" uuid,
	"erased_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "person_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"email" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"function" "work_function" NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer NOT NULL,
	"default_probability" integer DEFAULT 0 NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "pipeline_stages_probability_range" CHECK ("pipeline_stages"."default_probability" >= 0 AND "pipeline_stages"."default_probability" <= 100)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid,
	"edition_id" uuid,
	"function" "work_function" NOT NULL,
	"metric" "target_metric" NOT NULL,
	"target_value" numeric(14, 2) NOT NULL,
	"currency" char(3),
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "targets_currency_required_for_revenue" CHECK (("targets"."metric" <> 'revenue') OR ("targets"."currency" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "user_event_scopes" (
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "user_event_scopes_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "user_functions" (
	"user_id" uuid NOT NULL,
	"function" "work_function" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "user_functions_user_id_function_pk" PRIMARY KEY("user_id","function")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'team_member' NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"timezone" text DEFAULT 'Asia/Dubai' NOT NULL,
	"can_view_commission" boolean DEFAULT false NOT NULL,
	"can_manage_commission_rules" boolean DEFAULT false NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_rule_id_commission_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."commission_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_reverses_fk" FOREIGN KEY ("reverses_entry_id") REFERENCES "public"."commission_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rule_tiers" ADD CONSTRAINT "commission_rule_tiers_rule_id_commission_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."commission_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_scope_event_id_events_id_fk" FOREIGN KEY ("scope_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_scope_edition_id_editions_id_fk" FOREIGN KEY ("scope_edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_scope_user_id_users_id_fk" FOREIGN KEY ("scope_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_merged_into_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_domains" ADD CONSTRAINT "company_domains_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erasures" ADD CONSTRAINT "erasures_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erasures" ADD CONSTRAINT "erasures_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merges" ADD CONSTRAINT "merges_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merges" ADD CONSTRAINT "merges_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_secondary_owner_id_users_id_fk" FOREIGN KEY ("secondary_owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_cloned_from_fk" FOREIGN KEY ("cloned_from_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_merged_into_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_emails" ADD CONSTRAINT "person_emails_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_event_scopes" ADD CONSTRAINT "user_event_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_event_scopes" ADD CONSTRAINT "user_event_scopes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_functions" ADD CONSTRAINT "user_functions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_opportunity_occurred_idx" ON "activities" USING btree ("opportunity_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "commission_entries_user_effective_idx" ON "commission_entries" USING btree ("user_id","effective_at");--> statement-breakpoint
CREATE INDEX "commission_entries_opportunity_idx" ON "commission_entries" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "commission_entries_reverses_idx" ON "commission_entries" USING btree ("reverses_entry_id");--> statement-breakpoint
CREATE INDEX "commission_rule_tiers_rule_idx" ON "commission_rule_tiers" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "commission_rules_function_effective_idx" ON "commission_rules" USING btree ("function","effective_from");--> statement-breakpoint
CREATE INDEX "companies_normalized_name_idx" ON "companies" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "companies_merged_into_idx" ON "companies" USING btree ("merged_into_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_domains_domain_key" ON "company_domains" USING btree (lower("domain"));--> statement-breakpoint
CREATE INDEX "company_domains_company_idx" ON "company_domains" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "editions_event_slug_key" ON "editions" USING btree ("event_id","slug");--> statement-breakpoint
CREATE INDEX "editions_event_idx" ON "editions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "erasures_person_idx" ON "erasures" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_key" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "form_submissions_status_created_idx" ON "form_submissions" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invitations_user_idx" ON "invitations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loss_reasons_function_key" ON "loss_reasons" USING btree ("function","key");--> statement-breakpoint
CREATE INDEX "merges_entity_idx" ON "merges" USING btree ("entity_type","source_id");--> statement-breakpoint
CREATE INDEX "opportunities_owner_stage_idx" ON "opportunities" USING btree ("owner_id","stage_key");--> statement-breakpoint
CREATE INDEX "opportunities_edition_function_stage_idx" ON "opportunities" USING btree ("edition_id","function","stage_key");--> statement-breakpoint
CREATE INDEX "opportunities_company_idx" ON "opportunities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "opportunities_person_idx" ON "opportunities" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "opportunities_next_action_idx" ON "opportunities" USING btree ("next_action_due_at") WHERE "opportunities"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "opportunities_won_idx" ON "opportunities" USING btree ("won_at") WHERE "opportunities"."won_at" is not null;--> statement-breakpoint
CREATE INDEX "opportunities_unassigned_idx" ON "opportunities" USING btree ("created_at") WHERE "opportunities"."owner_id" is null and "opportunities"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "people_company_idx" ON "people" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "people_normalized_name_idx" ON "people" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "people_merged_into_idx" ON "people" USING btree ("merged_into_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_emails_email_key" ON "person_emails" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "person_emails_one_primary_key" ON "person_emails" USING btree ("person_id") WHERE "person_emails"."is_primary";--> statement-breakpoint
CREATE INDEX "person_emails_person_idx" ON "person_emails" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stages_function_key" ON "pipeline_stages" USING btree ("function","key");--> statement-breakpoint
CREATE INDEX "targets_user_edition_function_idx" ON "targets" USING btree ("user_id","edition_id","function");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_role_status_idx" ON "users" USING btree ("role","status");