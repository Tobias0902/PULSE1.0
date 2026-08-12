CREATE TABLE "core"."modules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"sdk_version" text NOT NULL,
	"is_core" boolean DEFAULT false NOT NULL,
	"depends_on" text[] DEFAULT '{}' NOT NULL,
	"postgres_schema" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."organization_modules" (
	"organization_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"activated_at" timestamp with time zone,
	"activated_by" uuid,
	"deactivated_at" timestamp with time zone,
	"deactivated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_modules_organization_id_module_id_pk" PRIMARY KEY("organization_id","module_id")
);
--> statement-breakpoint
ALTER TABLE "core"."organization_modules" ADD CONSTRAINT "organization_modules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_modules" ADD CONSTRAINT "organization_modules_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "core"."modules"("id") ON DELETE no action ON UPDATE no action;