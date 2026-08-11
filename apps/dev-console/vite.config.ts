import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Single root .env is the source of truth for local dev (see README).
  envDir: "../..",
  server: {
    port: 5173,
  },
  test: {
    // This is a throwaway dev shell (see README) — a light smoke test is
    // enough; no full component-test suite is warranted for it yet.
    passWithNoTests: true,
  },
});
