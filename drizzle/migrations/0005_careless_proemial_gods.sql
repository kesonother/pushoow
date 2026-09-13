ALTER TABLE "event" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "search_text" text;--> statement-breakpoint
CREATE INDEX "event_city_idx" ON "event" USING btree ("city");--> statement-breakpoint
CREATE INDEX "event_country_idx" ON "event" USING btree ("country");--> statement-breakpoint
CREATE INDEX "event_category_idx" ON "event" USING btree ("category");--> statement-breakpoint
CREATE INDEX "event_language_idx" ON "event" USING btree ("language");--> statement-breakpoint
CREATE INDEX "event_location_kind_idx" ON "event" USING btree ("location_kind");--> statement-breakpoint
CREATE INDEX "event_visibility_starts_at_idx" ON "event" USING btree ("visibility","starts_at");--> statement-breakpoint
CREATE INDEX "event_search_text_gin_idx" ON "event" USING gin (to_tsvector('simple', coalesce("search_text", '')));