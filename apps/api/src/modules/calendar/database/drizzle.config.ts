import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit always runs with apps/api as cwd (see package.json's
// migrate:calendar:generate script), so the single root .env is always
// two levels up from apps/api.
config({ path: resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "./src/modules/calendar/database/calendar.schema.ts",
  out: "./src/modules/calendar/database/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://pulse:pulse_dev_password@localhost:5432/pulse_core",
  },
});
