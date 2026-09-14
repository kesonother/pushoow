CREATE TYPE "public"."import_kind" AS ENUM('guests', 'subscribers', 'events', 'calendar');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('uploaded', 'mapped', 'validated', 'committed', 'purged');--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"kind" "import_kind" NOT NULL,
	"calendar_id" text,
	"event_id" text,
	"target_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_hash" text NOT NULL,
	"ciphertext" text NOT NULL,
	"byte_size" integer NOT NULL,
	"status" "import_status" NOT NULL,
	"mapping" jsonb NOT NULL,
	"report" jsonb,
	"purge_after" timestamp with time zone NOT NULL,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "import_batch_hash_unique" UNIQUE("organization_id","kind","target_key","content_hash")
);
--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_batch_org_idx" ON "import_batch" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "import_batch_purge_idx" ON "import_batch" USING btree ("purge_after");