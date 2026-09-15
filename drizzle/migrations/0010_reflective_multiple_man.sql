CREATE TYPE "public"."analytics_plan_tier" AS ENUM('free', 'pro', 'plus');--> statement-breakpoint
CREATE TYPE "public"."analytics_scope" AS ENUM('organization', 'event');--> statement-breakpoint
CREATE TYPE "public"."registration_source" AS ENUM('direct', 'checkout', 'walk_in', 'import', 'search');--> statement-breakpoint
CREATE TABLE "analytics_plan" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"plan" "analytics_plan_tier" DEFAULT 'free' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"scope" "analytics_scope" NOT NULL,
	"scope_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "analytics_snapshot_scope_unique" UNIQUE("scope","scope_id")
);
--> statement-breakpoint
CREATE TABLE "event_page_view_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "event_page_view_daily_unique" UNIQUE("event_id","day")
);
--> statement-breakpoint
CREATE TABLE "event_page_view_visitor" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"day" date NOT NULL,
	"visitor_hash" text NOT NULL,
	CONSTRAINT "event_page_view_visitor_unique" UNIQUE("event_id","day","visitor_hash")
);
--> statement-breakpoint
CREATE TABLE "registration_attribution" (
	"registration_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"source" "registration_source" DEFAULT 'direct' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text
);
--> statement-breakpoint
ALTER TABLE "analytics_plan" ADD CONSTRAINT "analytics_plan_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_snapshot" ADD CONSTRAINT "analytics_snapshot_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_page_view_daily" ADD CONSTRAINT "event_page_view_daily_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_page_view_daily" ADD CONSTRAINT "event_page_view_daily_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_page_view_visitor" ADD CONSTRAINT "event_page_view_visitor_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_attribution" ADD CONSTRAINT "registration_attribution_registration_id_event_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_attribution" ADD CONSTRAINT "registration_attribution_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_attribution" ADD CONSTRAINT "registration_attribution_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_page_view_daily_org_day_idx" ON "event_page_view_daily" USING btree ("organization_id","day");--> statement-breakpoint
CREATE INDEX "registration_attribution_event_idx" ON "registration_attribution" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "registration_attribution_org_idx" ON "registration_attribution" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_registration_org_created_idx" ON "event_registration" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "calendar_follower_user_id_idx" ON "calendar_follower" USING btree ("user_id");