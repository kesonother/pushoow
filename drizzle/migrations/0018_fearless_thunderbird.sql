CREATE TYPE "public"."ai_generation_kind" AS ENUM('description', 'cover', 'search', 'suggestions', 'recap');--> statement-breakpoint
CREATE TABLE "ai_consent" (
	"user_id" text PRIMARY KEY NOT NULL,
	"processing_opt_out" boolean DEFAULT false NOT NULL,
	"training_consent" boolean DEFAULT false NOT NULL,
	"disclosure_acknowledged" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"actor_user_id" text,
	"kind" "ai_generation_kind" NOT NULL,
	"provider_id" text NOT NULL,
	"model" text NOT NULL,
	"input_hash" text NOT NULL,
	"output_summary" text NOT NULL,
	"ai_generated" boolean DEFAULT true NOT NULL,
	"training_allowed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_org_policy" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"opted_out" boolean DEFAULT false NOT NULL,
	"training_allowed" boolean DEFAULT false NOT NULL,
	"provider_retention_days" integer DEFAULT 0 NOT NULL,
	"disclosure_version" text DEFAULT '1' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_org_policy_org_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "ai_consent" ADD CONSTRAINT "ai_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_org_policy" ADD CONSTRAINT "ai_org_policy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_generation_org_idx" ON "ai_generation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_generation_actor_idx" ON "ai_generation" USING btree ("actor_user_id");