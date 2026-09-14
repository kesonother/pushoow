CREATE TYPE "public"."billing_cancellation_status" AS ENUM('pending_confirmation', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."billing_invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."billing_item_kind" AS ENUM('plan', 'addon');--> statement-breakpoint
CREATE TYPE "public"."billing_subscription_status" AS ENUM('trialing', 'active', 'past_due', 'grace', 'canceled', 'expired');--> statement-breakpoint
CREATE TABLE "billing_cancellation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"status" "billing_cancellation_status" NOT NULL,
	"confirmation_token" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"billing_organization_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"number" text NOT NULL,
	"status" "billing_invoice_status" NOT NULL,
	"currency" text NOT NULL,
	"price_cents" integer NOT NULL,
	"add_on_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"platform_fee_cents" integer DEFAULT 0 NOT NULL,
	"processor_fee_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"quote" jsonb NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"payment_method_id" text,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "billing_invoice_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "billing_payment_method" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"billing_organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"brand" text,
	"last4" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"billing_organization_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" "billing_subscription_status" NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"pending_plan_id" text,
	"grace_ends_at" timestamp with time zone,
	"renewal_notice_14_sent_at" timestamp with time zone,
	"renewal_notice_7_sent_at" timestamp with time zone,
	"checkout_session_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscription_item" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"kind" "billing_item_kind" NOT NULL,
	"plan_id" text,
	"add_on_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"metric" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "billing_usage_org_metric_period_unique" UNIQUE("organization_id","metric","period_start")
);
--> statement-breakpoint
ALTER TABLE "billing_cancellation" ADD CONSTRAINT "billing_cancellation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cancellation" ADD CONSTRAINT "billing_cancellation_subscription_id_billing_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_billing_organization_id_organization_id_fk" FOREIGN KEY ("billing_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_subscription_id_billing_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_method" ADD CONSTRAINT "billing_payment_method_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_method" ADD CONSTRAINT "billing_payment_method_billing_organization_id_organization_id_fk" FOREIGN KEY ("billing_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_billing_organization_id_organization_id_fk" FOREIGN KEY ("billing_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription_item" ADD CONSTRAINT "billing_subscription_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription_item" ADD CONSTRAINT "billing_subscription_item_subscription_id_billing_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_usage" ADD CONSTRAINT "billing_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_cancellation_sub_idx" ON "billing_cancellation" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_invoice_org_idx" ON "billing_invoice" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_invoice_session_idx" ON "billing_invoice" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "billing_payment_method_billing_org_idx" ON "billing_payment_method" USING btree ("billing_organization_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_org_idx" ON "billing_subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_billing_org_idx" ON "billing_subscription" USING btree ("billing_organization_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_period_end_idx" ON "billing_subscription" USING btree ("status","current_period_end");--> statement-breakpoint
CREATE INDEX "billing_subscription_checkout_idx" ON "billing_subscription" USING btree ("checkout_session_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_item_sub_idx" ON "billing_subscription_item" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_usage_org_idx" ON "billing_usage" USING btree ("organization_id");