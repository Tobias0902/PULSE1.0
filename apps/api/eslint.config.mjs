import { baseConfig } from "@pulse/config/eslint.base.mjs";

// CLAUDE.md Decision #7 §17 build-time boundary enforcement
// (MODULE_SDK_DESIGN.md §3): a module's source must not import another
// module's or Core's Drizzle schema file directly — only through that
// module's own exported service layer. Enforced via the built-in
// no-restricted-imports rule rather than a dedicated plugin, since the two
// concrete cases (a module's own <id>.schema file, and Core's own
// schema.ts) are already distinguishable by this repo's filename
// convention.
//
// Known limitation: this only catches import specifiers containing a
// literal "modules/<id>/database/" segment. A future module importing a
// *sibling* module's schema via a same-depth relative path (e.g.
// "../crm/database/crm.schema" from within another modules/* directory)
// would not contain that segment and would not be caught. There is only
// one non-Core module today (Calendar), so this gap has no real case to
// design or test against yet — revisit once a second module exists.
const forbidOtherModuleSchema = {
  group: ["**/modules/*/database/*.schema"],
  message:
    "Import another module's data through its own exported service, not its Drizzle schema directly (CLAUDE.md Decision #7 §9).",
};
const forbidCoreSchema = {
  group: ["**/database/schema"],
  message:
    "Modules must not import Core's Drizzle schema directly — go through Core's own exported service (CLAUDE.md Decision #7 §9).",
};

export default [
  ...baseConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [forbidOtherModuleSchema] }],
    },
  },
  {
    // The one approved cross-module schema aggregation point (the
    // module-schemas.ts bootstrap wiring documented in that file) — exempt
    // from the rule above, not from the boundary concept itself.
    files: ["src/database/module-schemas.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // A module's own source is held to both rules: it may not reach into
    // another module's schema, and it may not reach into Core's either.
    files: ["src/modules/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [forbidOtherModuleSchema, forbidCoreSchema] }],
    },
  },
];
