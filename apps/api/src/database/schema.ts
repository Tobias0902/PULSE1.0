import {
  pgSchema,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// PULSE-Core owns this schema exclusively this iteration. Per CLAUDE.md
// Decision #7, future optional modules (QM, AI, CRM-proper, ...) get their
// own Postgres schema and must never reach into this one directly.
export const core = pgSchema("core");

const auditedColumns = {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  version: integer("version").notNull().default(1),
};

export const organizations = core.table("organizations", {
  ...auditedColumns,
  name: text("name").notNull(),
});

export const locations = core.table("locations", {
  ...auditedColumns,
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  address: text("address"),
});

export const users = core.table("users", {
  ...auditedColumns,
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// Placeholder catalog for this foundation iteration only — see
// packages/domain/src/permission-keys.ts. Not the final Decision #4 catalog.
export const permissions = core.table("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
});

export const roles = core.table("roles", {
  ...auditedColumns,
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
});

export const rolePermissions = core.table(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRoles = core.table(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

// Server-side-tracked, individually revocable session record per
// Decision #4 principle 6. Never stores the raw refresh token, only its hash.
export const refreshTokens = core.table("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const customers = core.table("customers", {
  ...auditedColumns,
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
});

// Persistent lifecycle anchor for one concrete device belonging to one
// customer. Does NOT move through a workflow itself (see CLAUDE.md).
//
// organizationId is denormalized here (rather than resolved by walking
// customerId -> customers.organizationId on every query) so every read can
// be scoped directly at the query level. It is set once at creation from
// the owning customer's organization and never changes independently.
export const assistiveDevices = core.table(
  "assistive_devices",
  {
    ...auditedColumns,
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    label: text("label").notNull(),
    // Free text, not an enum: PULSE-Core stays industry-neutral.
    deviceType: text("device_type"),
  },
  (t) => [index("assistive_devices_organization_id_idx").on(t.organizationId)],
);

export const cases = core.table(
  "cases",
  {
    ...auditedColumns,
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    assistiveDeviceId: uuid("assistive_device_id")
      .notNull()
      .references(() => assistiveDevices.id),
    title: text("title").notNull(),
    // Free text, not an enum: "maintenance"/"repair"/"new supply" are LimbArt
    // examples only and must never be hardcoded system-defined case types.
    type: text("type"),
    status: text("status").notNull().default("open"),
  },
  (t) => [index("cases_organization_id_idx").on(t.organizationId)],
);

export const appointments = core.table(
  "appointments",
  {
    ...auditedColumns,
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
  },
  (t) => [index("appointments_organization_id_idx").on(t.organizationId)],
);

// Append-only. No update/delete endpoints are exposed for this table.
export const auditEvents = core.table("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  userId: uuid("user_id").references(() => users.id),
  entityType: text("entity_type").notNull(),
  // Opaque identifier, not necessarily a UUID: most entities are
  // UUID-keyed, but module ids (e.g. "test-base") are stable strings.
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Installation-wide catalog of module code this binary has compiled in,
// synced from the static descriptor list at boot (CLAUDE.md Decision #7).
// Never written to directly by request handlers.
export const modules = core.table("modules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  sdkVersion: text("sdk_version").notNull(),
  isCore: boolean("is_core").notNull().default(false),
  dependsOn: text("depends_on").array().notNull().default([]),
  postgresSchema: text("postgres_schema"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Per-organization module activation state. Deactivating a module blocks
// its guarded routes but never deletes or alters its data (Decision #7 §11).
export const organizationModules = core.table(
  "organization_modules",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id),
    isActive: boolean("is_active").notNull().default(false),
    config: jsonb("config").notNull().default({}),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    activatedBy: uuid("activated_by"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    deactivatedBy: uuid("deactivated_by"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.moduleId] })],
);

// One settings blob per organization/location (CLAUDE.md Decision #7 §1).
// A jsonb blob rather than dedicated columns per setting: settings will
// grow across future modules, and a typed column per flag would mean a
// migration per flag forever. No row until the first write — a fresh
// organization/location has default (empty) settings without needing one.
export const organizationSettings = core.table("organization_settings", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id),
  settings: jsonb("settings").notNull().default({}),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

export const locationSettings = core.table("location_settings", {
  locationId: uuid("location_id")
    .primaryKey()
    .references(() => locations.id),
  settings: jsonb("settings").notNull().default({}),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});
