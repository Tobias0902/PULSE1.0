import { resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as argon2 from "argon2";
import * as schema from "./schema";
import { MODULE_DESCRIPTORS } from "../module-registry/module-descriptors";

// Package scripts always run with apps/api as cwd (pnpm --filter / turbo),
// so the single root .env is always two levels up from here.
config({ path: resolve(process.cwd(), "../../.env") });

// Development-only seed data. This is NOT a customer template — a real
// installation's first administrator is created via the (separate, not yet
// built) admin bootstrap process, not this script. Refuses to run in
// production so it can never be mistaken for one.

const DEV_ADMIN_EMAIL = "admin@pulse.dev";
const DEV_ADMIN_PASSWORD = "dev-admin-password-change-me";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run development seed data with NODE_ENV=production.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  const [organization] = await db
    .insert(schema.organizations)
    .values({ name: "PULSE Dev Organization" })
    .onConflictDoNothing()
    .returning();

  const org =
    organization ??
    (await db.query.organizations.findFirst({
      where: (organizations, { eq }) => eq(organizations.name, "PULSE Dev Organization"),
    }));
  if (!org) throw new Error("Failed to seed dev organization.");

  // Sourced from every registered module's descriptor, not just Core's own
  // keys, so a fresh dev DB gets a fully-usable Administrator role
  // regardless of which modules are compiled in. Always re-queried after
  // the upsert rather than relying on .returning() (which only reflects
  // newly-inserted rows) — re-running this script after new permission
  // keys were added must still grant the *complete* current set, not only
  // the ones added since the last run.
  const permissionValues = MODULE_DESCRIPTORS.flatMap((descriptor) =>
    descriptor.permissionKeys.map((key) => ({ key, description: `${descriptor.name}: ${key}` })),
  );
  await db.insert(schema.permissions).values(permissionValues).onConflictDoNothing();
  const allPermissions = await db.query.permissions.findMany();

  const [role] = await db
    .insert(schema.roles)
    .values({ organizationId: org.id, name: "Administrator" })
    .onConflictDoNothing()
    .returning();

  const adminRole =
    role ??
    (await db.query.roles.findFirst({
      where: (roles, { and, eq }) =>
        and(eq(roles.organizationId, org.id), eq(roles.name, "Administrator")),
    }));
  if (!adminRole) throw new Error("Failed to seed Administrator role.");

  if (allPermissions.length > 0) {
    await db
      .insert(schema.rolePermissions)
      .values(
        allPermissions.map((permission) => ({
          roleId: adminRole.id,
          permissionId: permission.id,
        })),
      )
      .onConflictDoNothing();
  }

  const passwordHash = await argon2.hash(DEV_ADMIN_PASSWORD, { type: argon2.argon2id });

  const [user] = await db
    .insert(schema.users)
    .values({
      organizationId: org.id,
      email: DEV_ADMIN_EMAIL,
      passwordHash,
      displayName: "PULSE Dev Admin",
    })
    .onConflictDoNothing()
    .returning();

  const adminUser =
    user ??
    (await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, DEV_ADMIN_EMAIL),
    }));
  if (!adminUser) throw new Error("Failed to seed dev admin user.");

  await db
    .insert(schema.userRoles)
    .values({ userId: adminUser.id, roleId: adminRole.id })
    .onConflictDoNothing();

  console.log(`Seeded dev organization "${org.name}".`);
  console.log(`Seeded dev admin login: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
