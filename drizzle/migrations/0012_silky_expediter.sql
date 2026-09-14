CREATE TYPE "public"."integration_provider" AS ENUM('hubspot', 'salesforce', 'pipedrive', 'mailchimp', 'klaviyo', 'customerio', 'notion', 'slack', 'discord', 'zoom', 'google_meet', 'microsoft_teams', 'youtube', 'vimeo', 'google_calendar', 'outlook');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('disconnected', 'pending', 'connected', 'error');--> statement-breakpoint
CREATE TABLE "integration_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"status" "integration_status" NOT NULL,
	"ciphertext" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"external_account_id" text,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "integration_connection_org_provider_unique" UNIQUE("organization_id","provider")
);
--> statement-breakpoint
CREATE TABLE "integration_external_ref" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"object_type" text NOT NULL,
	"local_id" text NOT NULL,
	"external_id" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "integration_external_ref_unique" UNIQUE("organization_id","provider","object_type","local_id")
);
--> statement-breakpoint
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_external_ref" ADD CONSTRAINT "integration_external_ref_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_connection_org_idx" ON "integration_connection" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_external_ref_org_idx" ON "integration_external_ref" USING btree ("organization_id");