CREATE TYPE "public"."status_incident_severity" AS ENUM('minor', 'major', 'critical');--> statement-breakpoint
CREATE TYPE "public"."status_incident_status" AS ENUM('investigating', 'identified', 'monitoring', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."status_maintenance_status" AS ENUM('scheduled', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."status_page_provider" AS ENUM('native', 'external');--> statement-breakpoint
CREATE TYPE "public"."support_channel" AS ENUM('email', 'in_app', 'phone', 'slack');--> statement-breakpoint
CREATE TYPE "public"."support_message_author" AS ENUM('requester', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."support_message_visibility" AS ENUM('public', 'internal');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_event_type" AS ENUM('opened', 'message_added', 'assigned', 'unassigned', 'status_changed', 'priority_changed', 'sla_breached', 'sla_escalated', 'resolved', 'closed', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_status" AS ENUM('open', 'assigned', 'pending', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "status_incident" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"status" "status_incident_status" NOT NULL,
	"severity" "status_incident_severity" NOT NULL,
	"impact" text NOT NULL,
	"provider" "status_page_provider" DEFAULT 'native' NOT NULL,
	"external_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"updates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "status_incident_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "status_maintenance" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" "status_maintenance_status" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"provider" "status_page_provider" DEFAULT 'native' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_uptime" (
	"id" text PRIMARY KEY NOT NULL,
	"component" text NOT NULL,
	"day" text NOT NULL,
	"uptime_bps" integer NOT NULL,
	CONSTRAINT "status_uptime_component_day_unique" UNIQUE("component","day")
);
--> statement-breakpoint
CREATE TABLE "support_ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"number" text NOT NULL,
	"subject" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"requester_email" text,
	"status" "support_ticket_status" NOT NULL,
	"priority" "support_ticket_priority" NOT NULL,
	"channel" "support_channel" NOT NULL,
	"channel_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assigned_to_user_id" text,
	"sla_policy_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"first_response_due_at" timestamp with time zone NOT NULL,
	"resolution_due_at" timestamp with time zone NOT NULL,
	"first_responded_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"first_response_breached_at" timestamp with time zone,
	"resolution_breached_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "support_ticket_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "support_ticket_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"assignee_user_id" text NOT NULL,
	"assigned_by_user_id" text NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	"unassigned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "support_ticket_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"type" "support_ticket_event_type" NOT NULL,
	"actor_user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_message" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"author_user_id" text,
	"author_kind" "support_message_author" NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visibility" "support_message_visibility" NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_assignment" ADD CONSTRAINT "support_ticket_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_assignment" ADD CONSTRAINT "support_ticket_assignment_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_event" ADD CONSTRAINT "support_ticket_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_event" ADD CONSTRAINT "support_ticket_event_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_message" ADD CONSTRAINT "support_ticket_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_message" ADD CONSTRAINT "support_ticket_message_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_maintenance_starts_idx" ON "status_maintenance" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "support_ticket_org_idx" ON "support_ticket" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "support_ticket_status_idx" ON "support_ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_ticket_first_response_due_idx" ON "support_ticket" USING btree ("first_response_due_at");--> statement-breakpoint
CREATE INDEX "support_ticket_resolution_due_idx" ON "support_ticket" USING btree ("resolution_due_at");--> statement-breakpoint
CREATE INDEX "support_ticket_assignment_ticket_idx" ON "support_ticket_assignment" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "support_ticket_event_ticket_idx" ON "support_ticket_event" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "support_ticket_message_ticket_idx" ON "support_ticket_message" USING btree ("ticket_id");