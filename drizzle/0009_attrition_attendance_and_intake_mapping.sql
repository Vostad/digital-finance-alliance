ALTER TABLE "editions" ADD COLUMN "public_intake_key" text;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD COLUMN "is_attendance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD COLUMN "is_attrition" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "editions_public_intake_key" ON "editions" USING btree ("public_intake_key");