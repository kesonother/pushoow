CREATE TYPE "public"."event_location_kind" AS ENUM('physical', 'virtual', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."event_registration_mode" AS ENUM('open_rsvp', 'approval', 'invitation', 'password', 'email_domain', 'token');--> statement-breakpoint
CREATE TYPE "public"."coupon_kind" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."event_content_kind" AS ENUM('speaker', 'agenda', 'faq');--> statement-breakpoint
CREATE TYPE "public"."event_order_status" AS ENUM('pending', 'paid', 'cancelled', 'refund_pending', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."event_registration_status" AS ENUM('pending', 'confirmed', 'waitlisted', 'offered', 'cancelled', 'checked_in', 'expired');--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."ticket_visibility" AS ENUM('public', 'unlisted', 'members');--> statement-breakpoint
ALTER TYPE "public"."event_status" ADD VALUE 'scheduled' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."event_status" ADD VALUE 'live' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."event_status" ADD VALUE 'ended' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."event_status" ADD VALUE 'postponed';--> statement-breakpoint
CREATE TABLE "event_add_on" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"capacity" integer,
	"inventory" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_content" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"kind" "event_content_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"starts_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_coupon" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text,
	"code" text NOT NULL,
	"kind" "coupon_kind" NOT NULL,
	"amount" integer NOT NULL,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_coupon_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "event_occurrence_override" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"original_starts_at" timestamp with time zone NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_order" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"buyer_email" text NOT NULL,
	"buyer_user_id" text,
	"status" "event_order_status" DEFAULT 'pending' NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"coupon_id" text,
	"payment_external_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" text NOT NULL,
	"ticket_type_id" text,
	"add_on_id" text,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_recurrence_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"frequency" "recurrence_frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"weekdays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"until" timestamp with time zone,
	"count" integer,
	"exceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_registration" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"status" "event_registration_status" DEFAULT 'confirmed' NOT NULL,
	"occurrence_starts_at" timestamp with time zone,
	"order_id" text,
	"ticket_type_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"offered_until" timestamp with time zone,
	"waitlist_position" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_registration_email_unique" UNIQUE("event_id","email")
);
--> statement-breakpoint
CREATE TABLE "event_ticket_type" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"capacity" integer,
	"sales_start" timestamp with time zone,
	"sales_end" timestamp with time zone,
	"visibility" "ticket_visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "capacity" integer;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "organizer_user_id" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "location_kind" "event_location_kind" DEFAULT 'physical' NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "custom_pin_label" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "virtual_url" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "virtual_provider" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "registration_mode" "event_registration_mode" DEFAULT 'open_rsvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "registration_password_hash" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "allowed_email_domains" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "waitlist_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "waitlist_during_presale" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "series_id" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "recurrence_parent_id" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "is_occurrence_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "postponed_from_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "postponed_from_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "date_history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event_add_on" ADD CONSTRAINT "event_add_on_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_add_on" ADD CONSTRAINT "event_add_on_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_content" ADD CONSTRAINT "event_content_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_content" ADD CONSTRAINT "event_content_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_coupon" ADD CONSTRAINT "event_coupon_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_coupon" ADD CONSTRAINT "event_coupon_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrence_override" ADD CONSTRAINT "event_occurrence_override_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrence_override" ADD CONSTRAINT "event_occurrence_override_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_order" ADD CONSTRAINT "event_order_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_order" ADD CONSTRAINT "event_order_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_order_item" ADD CONSTRAINT "event_order_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_order_item" ADD CONSTRAINT "event_order_item_order_id_event_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."event_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_recurrence_rule" ADD CONSTRAINT "event_recurrence_rule_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_recurrence_rule" ADD CONSTRAINT "event_recurrence_rule_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ticket_type" ADD CONSTRAINT "event_ticket_type_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ticket_type" ADD CONSTRAINT "event_ticket_type_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_add_on_event_id_idx" ON "event_add_on" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_content_event_id_idx" ON "event_content" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_order_event_id_idx" ON "event_order" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_registration_event_id_idx" ON "event_registration" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_ticket_type_event_id_idx" ON "event_ticket_type" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_slug_unique" UNIQUE("slug");