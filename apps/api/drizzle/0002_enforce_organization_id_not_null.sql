ALTER TABLE "core"."appointments" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."assistive_devices" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."cases" ALTER COLUMN "organization_id" SET NOT NULL;