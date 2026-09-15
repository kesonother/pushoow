CREATE TYPE "public"."embed_kind" AS ENUM('calendar', 'rsvp', 'ticket');--> statement-breakpoint
CREATE TYPE "public"."referral_conversion_status" AS ENUM('attributed', 'eligible', 'granted', 'rejected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."referral_kind" AS ENUM('organizer', 'attendee');--> statement-breakpoint
CREATE TYPE "public"."referral_reward_status" AS ENUM('none', 'pending', 'granted');--> statement-breakpoint
CREATE TABLE "embed_impression_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "embed_kind" NOT NULL,
	"resource_id" text NOT NULL,
	"day" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "embed_impression_daily_unique" UNIQUE("kind","resource_id","day")
);
--> statement-breakpoint
CREATE TABLE "referral_code" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"kind" "referral_kind" NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"event_id" text,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "referral_code_code_unique" UNIQUE("code"),
	CONSTRAINT "referral_code_organizer_user_unique" UNIQUE("user_id","kind","event_id")
);
--> statement-breakpoint
CREATE TABLE "referral_conversion" (
	"id" text PRIMARY KEY NOT NULL,
	"code_id" text NOT NULL,
	"kind" "referral_kind" NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referee_user_id" text,
	"referee_email" text,
	"event_id" text,
	"organization_id" text,
	"visitor_hash" text,
	"status" "referral_conversion_status" NOT NULL,
	"reward_status" "referral_reward_status" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_code_id_referral_code_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."referral_code"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_referrer_user_id_user_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_referee_user_id_user_id_fk" FOREIGN KEY ("referee_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_code_user_idx" ON "referral_code" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referral_conversion_code_idx" ON "referral_conversion" USING btree ("code_id");--> statement-breakpoint
CREATE INDEX "referral_conversion_referrer_idx" ON "referral_conversion" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "referral_conversion_referee_idx" ON "referral_conversion" USING btree ("referee_user_id");