CREATE TYPE "public"."mobile_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."mobile_push_provider" AS ENUM('apns', 'fcm');--> statement-breakpoint
CREATE TABLE "mobile_device" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" "mobile_platform" NOT NULL,
	"push_provider" "mobile_push_provider" NOT NULL,
	"token" text NOT NULL,
	"app_bundle_id" text,
	"widget_installed" boolean DEFAULT false NOT NULL,
	"watch_paired" boolean DEFAULT false NOT NULL,
	"last_snapshot_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "mobile_device_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "mobile_device" ADD CONSTRAINT "mobile_device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mobile_device_user_idx" ON "mobile_device" USING btree ("user_id");