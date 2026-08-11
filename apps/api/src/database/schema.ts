import {
  pgSchema,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  primaryKey,
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
export const assistiveDevices = core.table("assistive_devices", {
  ...auditedColumns,
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  label: text("label").notNull(),
  // Free text, not an enum: PULSE-Core stays industry-neutral.
  deviceType: text("device_type"),
});

export const cases = core.table("cases", {
  ...auditedColumns,
  assistiveDeviceId: uuid("assistive_device_id")
    .notNull()
    .references(() => assistiveDevices.id),
  title: text("title").notNull(),
  // Free text, not an enum: "maintenance"/"repair"/"new supply" are LimbArt
  // examples only and must never be hardcoded system-defined case types.
  type: text("type"),
  status: text("status").notNull().default("open"),
});

export const appointments = core.table("appointments", {
  ...auditedColumns,
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  notes: text("notes"),
});

// Append-only. No update/delete endpoints are exposed for this table.
export const auditEvents = core.table("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  userId: uuid("user_id").references(() => users.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
