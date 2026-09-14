CREATE TYPE "public"."notification_category" AS ENUM('transactional', 'reminder', 'event_update', 'cancellation', 'new_event', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'whatsapp', 'web_push', 'mobile_push');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('queued', 'sent', 'failed', 'suppressed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_suppression_reason" AS ENUM('bounce', 'complaint', 'unsubscribe', 'stop');--> statement-breakpoint
CREATE TYPE "public"."sms_consent_status" AS ENUM('opted_in', 'opted_out');--> statement-breakpoint
CREATE TABLE "newsletter" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"subject_a" text NOT NULL,
	"subject_b" text,
	"blocks" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"channel" "notification_channel" NOT NULL,
	"category" "notification_category" NOT NULL,
	"template_key" text NOT NULL,
	"to" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" "notification_delivery_status" NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_message_id" text,
	"variant" text,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"tracking_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notification_delivery_idempotency_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"category" "notification_category" NOT NULL,
	"enabled" boolean NOT NULL,
	"tracking_consent" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notification_preference_unique" UNIQUE("user_id","channel","category")
);
--> statement-breakpoint
CREATE TABLE "notification_suppression" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"address" text NOT NULL,
	"reason" "notification_suppression_reason" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notification_suppression_unique" UNIQUE("channel","address")
);
--> statement-breakpoint
CREATE TABLE "notification_template" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"version" integer NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notification_template_version_unique" UNIQUE("key","channel","locale","version")
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"endpoint" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "sms_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"phone" text NOT NULL,
	"status" "sms_consent_status" NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sms_consent_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "newsletter" ADD CONSTRAINT "newsletter_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter" ADD CONSTRAINT "newsletter_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_consent" ADD CONSTRAINT "sms_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletter_calendar_id_idx" ON "newsletter" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_to_idx" ON "notification_delivery" USING btree ("to");--> statement-breakpoint
CREATE INDEX "notification_preference_user_id_idx" ON "notification_preference" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_suppression_address_idx" ON "notification_suppression" USING btree ("address");--> statement-breakpoint
CREATE INDEX "push_subscription_user_id_idx" ON "push_subscription" USING btree ("user_id");