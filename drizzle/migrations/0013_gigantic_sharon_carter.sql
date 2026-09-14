CREATE TYPE "public"."public_api_plan" AS ENUM('free', 'pro', 'plus', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."public_webhook_delivery_status" AS ENUM('pending', 'delivered', 'failed', 'dead');--> statement-breakpoint
CREATE TABLE "public_api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"plan" "public_api_plan" NOT NULL,
	"rate_limit_per_minute" integer,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "public_api_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "public_oauth_client" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"secret_hash" text,
	"redirect_uris" text[] DEFAULT '{}' NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_oauth_code" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_hash" text NOT NULL,
	"code_challenge" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "public_oauth_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "public_webhook_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"endpoint_id" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "public_webhook_delivery_status" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"response_status" integer,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_webhook_endpoint" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"url" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"events" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public_api_key" ADD CONSTRAINT "public_api_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_oauth_client" ADD CONSTRAINT "public_oauth_client_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_oauth_code" ADD CONSTRAINT "public_oauth_code_client_id_public_oauth_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."public_oauth_client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_oauth_code" ADD CONSTRAINT "public_oauth_code_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_webhook_delivery" ADD CONSTRAINT "public_webhook_delivery_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_webhook_delivery" ADD CONSTRAINT "public_webhook_delivery_endpoint_id_public_webhook_endpoint_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."public_webhook_endpoint"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_webhook_endpoint" ADD CONSTRAINT "public_webhook_endpoint_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_api_key_org_idx" ON "public_api_key" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "public_oauth_client_org_idx" ON "public_oauth_client" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "public_oauth_code_client_idx" ON "public_oauth_code" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "public_webhook_delivery_endpoint_idx" ON "public_webhook_delivery" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "public_webhook_delivery_org_idx" ON "public_webhook_delivery" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "public_webhook_endpoint_org_idx" ON "public_webhook_endpoint" USING btree ("organization_id");