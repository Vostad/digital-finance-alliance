CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"payload" jsonb,
	"related_entity_type" text,
	"related_entity_id" uuid,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE INDEX "email_outbox_unsent_idx" ON "email_outbox" USING btree ("created_at") WHERE "email_outbox"."sent_at" is null;--> statement-breakpoint
CREATE INDEX "email_outbox_related_idx" ON "email_outbox" USING btree ("related_entity_type","related_entity_id");