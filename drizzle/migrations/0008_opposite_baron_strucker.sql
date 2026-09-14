CREATE TYPE "public"."checkout_payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."issued_ticket_status" AS ENUM('valid', 'refunded', 'void');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'restricted', 'verified');--> statement-breakpoint
CREATE TYPE "public"."payment_refund_kind" AS ENUM('individual', 'partial', 'full');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'active', 'disabled');--> statement-breakpoint
ALTER TYPE "public"."event_order_status" ADD VALUE 'partially_refunded';--> statement-breakpoint
CREATE TABLE "checkout_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "checkout_payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"checkout_url" text,
	"application_fee_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "checkout_payment_order_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "issued_ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"order_id" text NOT NULL,
	"registration_id" text,
	"ticket_type_id" text,
	"code" text NOT NULL,
	"status" "issued_ticket_status" DEFAULT 'valid' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "issued_ticket_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payment_refund" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"order_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"reason" text NOT NULL,
	"kind" "payment_refund_kind" NOT NULL,
	"stripe_refund_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_connected_account" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_account_id" text NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"payout_status" "payout_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "stripe_connected_account_org_unique" UNIQUE("organization_id"),
	CONSTRAINT "stripe_connected_account_stripe_unique" UNIQUE("stripe_account_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "stripe_webhook_event_stripe_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "tax_record" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" text NOT NULL,
	"currency" text NOT NULL,
	"tax_cents" integer NOT NULL,
	"exemption_code" text,
	"stripe_calculation_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_order" ADD COLUMN "ticket_subtotal_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_order" ADD COLUMN "addon_subtotal_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_order" ADD COLUMN "tax_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_order" ADD COLUMN "platform_fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_order" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "event_order" ADD COLUMN "connected_account_id" text;--> statement-breakpoint
ALTER TABLE "checkout_payment" ADD CONSTRAINT "checkout_payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_payment" ADD CONSTRAINT "checkout_payment_order_id_event_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."event_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_ticket" ADD CONSTRAINT "issued_ticket_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_ticket" ADD CONSTRAINT "issued_ticket_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_ticket" ADD CONSTRAINT "issued_ticket_order_id_event_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."event_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_ticket" ADD CONSTRAINT "issued_ticket_registration_id_event_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registration"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_ticket" ADD CONSTRAINT "issued_ticket_ticket_type_id_event_ticket_type_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."event_ticket_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_payment_id_checkout_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."checkout_payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_order_id_event_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."event_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connected_account" ADD CONSTRAINT "stripe_connected_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_record" ADD CONSTRAINT "tax_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_record" ADD CONSTRAINT "tax_record_order_id_event_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."event_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkout_payment_org_idx" ON "checkout_payment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "checkout_payment_session_idx" ON "checkout_payment" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "issued_ticket_order_idx" ON "issued_ticket" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_refund_org_idx" ON "payment_refund" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tax_record_org_idx" ON "tax_record" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "event_order" ADD CONSTRAINT "event_order_idempotency_key_unique" UNIQUE("idempotency_key");