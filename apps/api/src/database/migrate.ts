import { resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { MODULE_DESCRIPTORS } from "../module-registry/module-descriptors";

// Package scripts always run with apps/api as cwd (pnpm --filter / turbo),
// so the single root .env is always two levels up from here.
config({ path: resolve(process.cwd(), "../../.env") });

// One database connection per installation (CLAUDE.md Decision #2); each
// registered module's migrations folder is applied against it in turn.
// Core keeps drizzle's default migrations-tracking table (no custom
// migrationsTable) so its already-applied history stays intact — every
// other module gets its own tracking table, so one module's migration
// history is never confused with another's, and modules can be
// independently distributed/updated later without a shared table growing
// unboundedly (CLAUDE.md Decision #7 §14, §18).
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  const modulesWithMigrations = MODULE_DESCRIPTORS.filter(
    (descriptor) => descriptor.migrationsFolder !== null,
  );

  for (const descriptor of modulesWithMigrations) {
    console.log(`Applying migrations for module "${descriptor.id}"...`);
    await migrate(db, {
      migrationsFolder: descriptor.migrationsFolder!,
      ...(descriptor.id === "core" ? {} : { migrationsTable: `__drizzle_migrations_${descriptor.id}` }),
    });
  }

  await client.end();
  console.log("Migrations applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
