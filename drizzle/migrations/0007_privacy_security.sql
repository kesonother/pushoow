CREATE TYPE "public"."event_roster_mode" AS ENUM('visible', 'hidden', 'anonymized', 'approval_only');--> statement-breakpoint
CREATE TYPE "public"."consent_purpose" AS ENUM('necessary', 'marketing', 'tracking', 'data_sale');--> statement-breakpoint
CREATE TYPE "public"."deletion_status" AS ENUM('pending', 'processing', 'completed', 'rejected');--> statement-breakpoint
CREATE TABLE "privacy_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"organization_id" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_ccpa_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sale_opt_out" boolean DEFAULT true NOT NULL,
	"disclosure_acknowledged" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" "consent_purpose" NOT NULL,
	"granted" boolean NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_deletion_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "deletion_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "privacy_processing_record" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"organization_id" text,
	"purpose" text NOT NULL,
	"legal_basis" text NOT NULL,
	"categories" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "roster_mode" "event_roster_mode" DEFAULT 'hidden' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registration" ADD COLUMN "anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registration" ADD COLUMN "appear_on_roster" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendee_profile" ADD COLUMN "appear_on_roster" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendee_profile" ADD COLUMN "show_avatar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendee_profile" ADD COLUMN "show_bio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendee_profile" ADD COLUMN "show_social" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "privacy_ccpa_settings" ADD CONSTRAINT "privacy_ccpa_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_consent" ADD CONSTRAINT "privacy_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_deletion_request" ADD CONSTRAINT "privacy_deletion_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_processing_record" ADD CONSTRAINT "privacy_processing_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "privacy_audit_actor_idx" ON "privacy_audit" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "privacy_consent_user_id_idx" ON "privacy_consent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "privacy_deletion_user_status_idx" ON "privacy_deletion_request" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "privacy_processing_user_id_idx" ON "privacy_processing_record" USING btree ("user_id");