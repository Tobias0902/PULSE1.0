CREATE TABLE "core"."domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"event_type" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"causation_id" uuid,
	"correlation_id" uuid,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "core"."domain_events" ADD CONSTRAINT "domain_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "domain_events_dispatch_idx" ON "core"."domain_events" USING btree ("processed_at","occurred_at");--> statement-breakpoint
CREATE INDEX "domain_events_organization_event_type_idx" ON "core"."domain_events" USING btree ("organization_id","event_type");