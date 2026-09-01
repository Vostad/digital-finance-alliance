CREATE TABLE "withdrawal_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_lost_requires_reason";--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "withdrawal_reason_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "withdrawal_reasons_key" ON "withdrawal_reasons" USING btree ("key");--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_withdrawn_requires_reason" CHECK ("opportunities"."stage_key" <> 'withdrawn' OR "opportunities"."withdrawal_reason_key" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lost_requires_reason" CHECK ("opportunities"."stage_key" NOT IN ('lost', 'declined') OR "opportunities"."loss_reason_key" IS NOT NULL);