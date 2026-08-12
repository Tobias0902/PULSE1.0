ALTER TABLE "core"."appointments" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."assistive_devices" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."cases" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."appointments" ADD CONSTRAINT "appointments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."assistive_devices" ADD CONSTRAINT "assistive_devices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."cases" ADD CONSTRAINT "cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill from the existing parent chain, bottom-up: assistive_devices
-- from its customer, then cases from its (now-backfilled) device, then
-- appointments from its (now-backfilled) case. NOT NULL is enforced in a
-- later migration once every row has a value.
UPDATE "core"."assistive_devices" ad
SET "organization_id" = c."organization_id"
FROM "core"."customers" c
WHERE ad."customer_id" = c."id";--> statement-breakpoint
UPDATE "core"."cases" ca
SET "organization_id" = ad."organization_id"
FROM "core"."assistive_devices" ad
WHERE ca."assistive_device_id" = ad."id";--> statement-breakpoint
UPDATE "core"."appointments" ap
SET "organization_id" = ca."organization_id"
FROM "core"."cases" ca
WHERE ap."case_id" = ca."id";--> statement-breakpoint
CREATE INDEX "appointments_organization_id_idx" ON "core"."appointments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assistive_devices_organization_id_idx" ON "core"."assistive_devices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cases_organization_id_idx" ON "core"."cases" USING btree ("organization_id");