import { pgSchema, uuid, text, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Calendar owns this schema exclusively (CLAUDE.md Decision #7 §9). It
// must never be queried directly from Core or another module's code —
// only through Calendar's own exported service/API surface.
export const calendar = pgSchema("calendar");

// Local copy of Core's auditedColumns shape (apps/api/src/database/schema.ts)
// — not imported from Core, to avoid a module -> Core schema-file
// dependency. Every module redefines this same small constant.
const auditedColumns = {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  version: integer("version").notNull().default(1),
};

// organizationId/ownerUserId are bare columns, never foreign keys into
// Core's schema (CLAUDE.md Decision #7 §10) — Calendar's migrations must
// stay independent of Core's. Referential validity (the org/user actually
// exists) is enforced in the service layer, not by Postgres.
export const calendarEvents = calendar.table(
  "calendar_events",
  {
    ...auditedColumns,
    organizationId: uuid("organization_id").notNull(),
    ownerUserId: uuid("owner_user_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    // Destination model: exactly one of four kinds, discriminated by
    // locationType — "customerAddress" | "coreLocation" | "external" |
    // "remote". Only locationCustomerId/locationCoreLocationId/
    // (locationName+locationAddress) is populated, matching whichever
    // type is set; enforced at the service/domain-schema layer (a
    // discriminated union), not by a Postgres CHECK constraint, matching
    // this codebase's existing app-level-validation convention.
    //
    // locationCustomerId/locationCoreLocationId are bare references (no
    // FK — see the module-boundary note above) to Core's customers/
    // locations tables. Calendar never stores the resolved address text
    // for these two kinds — only "external" does, because the user typed
    // it directly into Calendar and Calendar is that data's actual source
    // of truth. Resolving a reference into a navigable address, and which
    // maps provider to use, is a client/integration-layer concern.
    locationType: text("location_type").notNull().default("remote"),
    locationCustomerId: uuid("location_customer_id"),
    locationCoreLocationId: uuid("location_core_location_id"),
    locationName: text("location_name"),
    locationAddress: text("location_address"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    isAllDay: boolean("is_all_day").notNull().default(false),
    timezone: text("timezone").notNull(),
    isPrivate: boolean("is_private").notNull().default(false),
    // "confirmed" | "cancelled" — soft lifecycle, no hard delete, matching
    // every other entity in this codebase.
    status: text("status").notNull().default("confirmed"),
    // User's own free-form color choice — never a hardcoded category.
    colorTag: text("color_tag"),
    // Origin reference (CLAUDE.md Decision #9 §6): bare, soft references to
    // the module/entity this event was created on behalf of. Defaults to
    // "calendar" for calendar-native events.
    sourceModuleId: text("source_module_id").notNull().default("calendar"),
    sourceEntityType: text("source_entity_type"),
    sourceEntityId: text("source_entity_id"),
  },
  (t) => [
    index("calendar_events_owner_start_idx").on(t.ownerUserId, t.startAt),
    index("calendar_events_organization_start_idx").on(t.organizationId, t.startAt),
    // Makes a future projection handler's upsert idempotent by
    // construction (CLAUDE.md Decision #9 §5) — not exercised yet (no
    // source module publishes into Calendar this iteration), but adding
    // the constraint now avoids a later migration once real rows exist.
    uniqueIndex("calendar_events_source_idx")
      .on(t.sourceModuleId, t.sourceEntityType, t.sourceEntityId)
      .where(sql`${t.sourceEntityId} is not null`),
  ],
);
