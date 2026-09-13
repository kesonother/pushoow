CREATE TYPE "public"."appeal_status" AS ENUM('none', 'submitted', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."attendee_visibility" AS ENUM('private', 'organization', 'public');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."moderation_reason_category" AS ENUM('policy', 'abuse', 'fraud', 'illegal', 'other');--> statement-breakpoint
CREATE TYPE "public"."moderation_type" AS ENUM('warning', 'temporary_suspension', 'permanent_ban');--> statement-breakpoint
CREATE TYPE "public"."sso_protocol" AS ENUM('saml', 'oidc');--> statement-breakpoint
CREATE TABLE "account_moderation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "moderation_type" NOT NULL,
	"reason" text NOT NULL,
	"reason_category" "moderation_reason_category" NOT NULL,
	"immediate" boolean NOT NULL,
	"notice_at" timestamp with time zone NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"created_by_user_id" text,
	"notified_at" timestamp with time zone,
	"appeal_status" "appeal_status" DEFAULT 'none' NOT NULL,
	"appeal_reason" text,
	"appealed_at" timestamp with time zone,
	"appeal_resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendee_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"website" text,
	"linkedin" text,
	"visibility" "attendee_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_domain" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"token_hash" text NOT NULL,
	"verified_at" timestamp with time zone,
	"auto_join" boolean DEFAULT false NOT NULL,
	"auto_join_role" "organization_role" DEFAULT 'read_only' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "organization_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "organization_role" NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_invitation_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "organization_sso_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"protocol" "sso_protocol" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizer_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"website" text,
	"linkedin" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_token" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"family_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"replaced_by_token_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "refresh_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "is_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account_moderation" ADD CONSTRAINT "account_moderation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_moderation" ADD CONSTRAINT "account_moderation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendee_profile" ADD CONSTRAINT "attendee_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_domain" ADD CONSTRAINT "organization_domain_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_sso_connection" ADD CONSTRAINT "organization_sso_connection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_profile" ADD CONSTRAINT "organizer_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_moderation_user_id_idx" ON "account_moderation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_moderation_starts_at_idx" ON "account_moderation" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "organization_domain_org_id_idx" ON "organization_domain" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitation_org_id_idx" ON "organization_invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitation_email_idx" ON "organization_invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "organization_sso_org_id_idx" ON "organization_sso_connection" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_token_family_id_idx" ON "refresh_token" USING btree ("family_id");