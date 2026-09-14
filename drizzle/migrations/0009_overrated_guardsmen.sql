CREATE TYPE "public"."check_in_source" AS ENUM('scan', 'search', 'bulk', 'walk_in', 'sync');--> statement-breakpoint
CREATE TABLE "check_in_capacity_alert" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"threshold" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "check_in_capacity_alert_unique" UNIQUE("event_id","threshold")
);
--> statement-breakpoint
CREATE TABLE "check_in_pass" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"registration_id" text NOT NULL,
	"issued_ticket_id" text,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "check_in_pass_registration_unique" UNIQUE("registration_id")
);
--> statement-breakpoint
CREATE TABLE "check_in_record" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"registration_id" text NOT NULL,
	"issued_ticket_id" text,
	"actor_user_id" text,
	"source" "check_in_source" NOT NULL,
	"device_id" text,
	"client_op_id" text NOT NULL,
	"checked_in_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "check_in_record_registration_unique" UNIQUE("event_id","registration_id"),
	CONSTRAINT "check_in_record_client_op_unique" UNIQUE("client_op_id")
);
--> statement-breakpoint
ALTER TABLE "check_in_capacity_alert" ADD CONSTRAINT "check_in_capacity_alert_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_capacity_alert" ADD CONSTRAINT "check_in_capacity_alert_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_pass" ADD CONSTRAINT "check_in_pass_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_pass" ADD CONSTRAINT "check_in_pass_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_pass" ADD CONSTRAINT "check_in_pass_registration_id_event_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_pass" ADD CONSTRAINT "check_in_pass_issued_ticket_id_issued_ticket_id_fk" FOREIGN KEY ("issued_ticket_id") REFERENCES "public"."issued_ticket"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_registration_id_event_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_issued_ticket_id_issued_ticket_id_fk" FOREIGN KEY ("issued_ticket_id") REFERENCES "public"."issued_ticket"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_in_pass_event_idx" ON "check_in_pass" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "check_in_record_event_idx" ON "check_in_record" USING btree ("event_id");