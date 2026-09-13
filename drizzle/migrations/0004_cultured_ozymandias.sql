CREATE TYPE "public"."chat_author_kind" AS ENUM('user', 'organizer');--> statement-breakpoint
CREATE TYPE "public"."chat_moderation_type" AS ENUM('soft_delete', 'hard_delete', 'ban', 'unban');--> statement-breakpoint
CREATE TYPE "public"."chat_report_status" AS ENUM('open', 'reviewed', 'dismissed');--> statement-breakpoint
CREATE TABLE "event_chat" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"event_id" text NOT NULL,
	"next_seq" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_chat_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "event_chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"parent_id" text,
	"author_user_id" text,
	"author_kind" "chat_author_kind" DEFAULT 'user' NOT NULL,
	"body" text NOT NULL,
	"client_id" text,
	"seq" integer NOT NULL,
	"deleted_at" timestamp with time zone,
	"hard_deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_chat_message_client_id_unique" UNIQUE("chat_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "event_chat_moderation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"type" "chat_moderation_type" NOT NULL,
	"target_user_id" text,
	"target_message_id" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_chat_report" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"message_id" text NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" "chat_report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_chat_report_unique" UNIQUE("message_id","reporter_user_id")
);
--> statement-breakpoint
CREATE TABLE "event_chat_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"title" text NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "banned_words" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event_chat" ADD CONSTRAINT "event_chat_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat" ADD CONSTRAINT "event_chat_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat" ADD CONSTRAINT "event_chat_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_message" ADD CONSTRAINT "event_chat_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_message" ADD CONSTRAINT "event_chat_message_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_message" ADD CONSTRAINT "event_chat_message_chat_id_event_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."event_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_message" ADD CONSTRAINT "event_chat_message_thread_id_event_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."event_chat_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_moderation" ADD CONSTRAINT "event_chat_moderation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_moderation" ADD CONSTRAINT "event_chat_moderation_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_moderation" ADD CONSTRAINT "event_chat_moderation_chat_id_event_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."event_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_report" ADD CONSTRAINT "event_chat_report_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_report" ADD CONSTRAINT "event_chat_report_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_report" ADD CONSTRAINT "event_chat_report_message_id_event_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."event_chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_thread" ADD CONSTRAINT "event_chat_thread_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_thread" ADD CONSTRAINT "event_chat_thread_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chat_thread" ADD CONSTRAINT "event_chat_thread_chat_id_event_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."event_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_chat_organization_id_idx" ON "event_chat" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_chat_message_event_seq_idx" ON "event_chat_message" USING btree ("event_id","seq");--> statement-breakpoint
CREATE INDEX "event_chat_message_thread_id_idx" ON "event_chat_message" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "event_chat_moderation_event_id_idx" ON "event_chat_moderation" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_chat_report_event_id_idx" ON "event_chat_report" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_chat_thread_event_id_idx" ON "event_chat_thread" USING btree ("event_id");