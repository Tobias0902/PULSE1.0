import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit always runs with apps/api as cwd, so the single root .env is
// always two levels up from here.
config({ path: resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://pulse:pulse_dev_password@localhost:5432/pulse_core",
  },
});
