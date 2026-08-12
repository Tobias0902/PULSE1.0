CREATE SCHEMA "calendar";
--> statement-breakpoint
CREATE TABLE "calendar"."calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location_type" text DEFAULT 'remote' NOT NULL,
	"location_customer_id" uuid,
	"location_core_location_id" uuid,
	"location_name" text,
	"location_address" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"timezone" text NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"color_tag" text,
	"source_module_id" text DEFAULT 'calendar' NOT NULL,
	"source_entity_type" text,
	"source_entity_id" text
);
--> statement-breakpoint
CREATE INDEX "calendar_events_owner_start_idx" ON "calendar"."calendar_events" USING btree ("owner_user_id","start_at");--> statement-breakpoint
CREATE INDEX "calendar_events_organization_start_idx" ON "calendar"."calendar_events" USING btree ("organization_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_source_idx" ON "calendar"."calendar_events" USING btree ("source_module_id","source_entity_type","source_entity_id") WHERE "calendar"."calendar_events"."source_entity_id" is not null;