CREATE TYPE "public"."billing_mode" AS ENUM('own', 'consolidated');--> statement-breakpoint
CREATE TYPE "public"."functional_level" AS ENUM('free', 'pro', 'plus', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."organization_kind" AS ENUM('standard', 'agency', 'client');--> statement-breakpoint
CREATE TYPE "public"."organization_domain_kind" AS ENUM('email', 'site');--> statement-breakpoint
ALTER TYPE "public"."organization_role" ADD VALUE 'custom';--> statement-breakpoint
CREATE TABLE "agency_client" (
	"id" text PRIMARY KEY NOT NULL,
	"agency_organization_id" text NOT NULL,
	"client_organization_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "agency_client_unique" UNIQUE("agency_organization_id","client_organization_id"),
	CONSTRAINT "agency_client_client_unique" UNIQUE("client_organization_id")
);
--> statement-breakpoint
CREATE TABLE "organization_custom_role" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"grants" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "kind" "organization_kind" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "agency_organization_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "functional_level" "functional_level" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "primary_color" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "secondary_color" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "billing_mode" "billing_mode" DEFAULT 'own' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "billing_organization_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "audit_retention_days" integer DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_member" ADD COLUMN "custom_role_id" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "before" jsonb;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "after" jsonb;--> statement-breakpoint
ALTER TABLE "organization_domain" ADD COLUMN "kind" "organization_domain_kind" DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_invitation" ADD COLUMN "custom_role_id" text;--> statement-breakpoint
ALTER TABLE "agency_client" ADD CONSTRAINT "agency_client_agency_organization_id_organization_id_fk" FOREIGN KEY ("agency_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_client" ADD CONSTRAINT "agency_client_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_custom_role" ADD CONSTRAINT "organization_custom_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agency_client_agency_idx" ON "agency_client" USING btree ("agency_organization_id");--> statement-breakpoint
CREATE INDEX "organization_custom_role_org_idx" ON "organization_custom_role" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_custom_role_id_organization_custom_role_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."organization_custom_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_custom_role_id_organization_custom_role_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."organization_custom_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_agency_idx" ON "organization" USING btree ("agency_organization_id");