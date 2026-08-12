import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure type definitions today (see README) — nothing to unit test yet.
    passWithNoTests: true,
  },
});
