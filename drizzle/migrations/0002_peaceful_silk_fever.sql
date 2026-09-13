CREATE TYPE "public"."calendar_membership_status" AS ENUM('pending', 'approved', 'rejected', 'awaiting_payment', 'active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."calendar_tier_kind" AS ENUM('free', 'one_time', 'subscription', 'tier_gated');--> statement-breakpoint
CREATE TYPE "public"."calendar_tier_visibility" AS ENUM('public', 'members');--> statement-breakpoint
CREATE TABLE "calendar_slug_change" (
	"id" text PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"from_slug" text NOT NULL,
	"to_slug" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_follower" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"user_id" text NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"notify_push" boolean DEFAULT false NOT NULL,
	"notify_sms" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "calendar_follower_user_unique" UNIQUE("calendar_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "calendar_member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tier_id" text NOT NULL,
	"status" "calendar_membership_status" DEFAULT 'pending' NOT NULL,
	"payment_external_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "calendar_member_user_unique" UNIQUE("calendar_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "calendar_membership_tier" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "calendar_tier_kind" NOT NULL,
	"visibility" "calendar_tier_visibility" DEFAULT 'public' NOT NULL,
	"member_only_tickets" boolean DEFAULT false NOT NULL,
	"newsletters" boolean DEFAULT false NOT NULL,
	"early_rsvp" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"price_cents" integer,
	"currency" text,
	"interval" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar" DROP CONSTRAINT "calendar_org_slug_unique";--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "default_currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "primary_color" text;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "social_link" text;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "postal_address" text;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "feed_token" text;--> statement-breakpoint
UPDATE "calendar" SET "feed_token" = replace(gen_random_uuid()::text, '-', '') WHERE "feed_token" IS NULL;--> statement-breakpoint
ALTER TABLE "calendar" ALTER COLUMN "feed_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "venue_name" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "venue_address" text;--> statement-breakpoint
ALTER TABLE "calendar_slug_change" ADD CONSTRAINT "calendar_slug_change_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_follower" ADD CONSTRAINT "calendar_follower_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_follower" ADD CONSTRAINT "calendar_follower_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_follower" ADD CONSTRAINT "calendar_follower_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_member" ADD CONSTRAINT "calendar_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_member" ADD CONSTRAINT "calendar_member_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_member" ADD CONSTRAINT "calendar_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_member" ADD CONSTRAINT "calendar_member_tier_id_calendar_membership_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."calendar_membership_tier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_membership_tier" ADD CONSTRAINT "calendar_membership_tier_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_membership_tier" ADD CONSTRAINT "calendar_membership_tier_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_slug_change_calendar_id_idx" ON "calendar_slug_change" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_slug_change_changed_at_idx" ON "calendar_slug_change" USING btree ("calendar_id","changed_at");--> statement-breakpoint
CREATE INDEX "calendar_follower_organization_id_idx" ON "calendar_follower" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "calendar_follower_calendar_id_idx" ON "calendar_follower" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_member_organization_id_idx" ON "calendar_member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "calendar_member_calendar_id_idx" ON "calendar_member" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_membership_tier_calendar_id_idx" ON "calendar_membership_tier" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_membership_tier_organization_id_idx" ON "calendar_membership_tier" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "calendar_visibility_idx" ON "calendar" USING btree ("visibility");--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_slug_unique" UNIQUE("slug");