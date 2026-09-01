CREATE TABLE "cancellation_reasons" (
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
ALTER TABLE "opportunities" ADD COLUMN "cancellation_reason_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "cancellation_reasons_key" ON "cancellation_reasons" USING btree ("key");--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_won_requires_final_value" CHECK ("opportunities"."function" <> 'sponsor' OR "opportunities"."stage_key" <> 'won' OR "opportunities"."final_value" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lost_requires_reason" CHECK ("opportunities"."stage_key" NOT IN ('lost', 'declined', 'withdrawn') OR "opportunities"."loss_reason_key" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_cancelled_requires_reason" CHECK ("opportunities"."stage_key" <> 'cancelled' OR "opportunities"."cancellation_reason_key" IS NOT NULL);