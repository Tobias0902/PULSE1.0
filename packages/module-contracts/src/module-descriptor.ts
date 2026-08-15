// A module descriptor is a compile-time declaration, not user input — it is
// registered in code (see apps/api/src/module-registry/module-descriptors.ts),
// not submitted through an API. Modules stay compile-time NestJS imports,
// first-party and in-process (CLAUDE.md Decision #7 §12); "activation" means
// a per-organization database flag gating an already-compiled module, never
// runtime code loading — that question is still explicitly open.
export interface ModuleDescriptor {
  /** Stable, code-level identifier, e.g. "core" or "crm". Never shown as a display name. */
  id: string;
  name: string;
  /** Semver string. */
  version: string;
  /** Module SDK contract version this descriptor targets, checked against the versions Core currently supports. */
  sdkVersion: string;
  /** True only for the single Core descriptor. */
  isCore: boolean;
  /** Other module ids that must already be active for an organization before this one can be activated there. */
  dependsOn: string[];
  /**
   * Permission keys this module contributes to the shared catalog
   * (CLAUDE.md Decision #4 §3-4). Non-Core modules must prefix every key
   * with their own module id (e.g. "crm:contact:read") to avoid collisions
   * with Core's own flat keys or another module's namespace.
   */
  permissionKeys: string[];
  /** The module's own Postgres schema name, or null for Core (which owns the "core" schema). */
  postgresSchema: string | null;
  /**
   * Path to this module's own Drizzle migrations folder, relative to
   * apps/api (matching drizzle.config.ts's existing `out` convention), or
   * null if the module owns no schema of its own. The migration runner
   * (apps/api/src/database/migrate.ts) applies every registered module's
   * folder in turn against the one shared database connection — modules
   * are independently *migrated*, never independently *databased*
   * (CLAUDE.md Decision #2: one database per installation).
   */
  migrationsFolder: string | null;
  /**
   * Capability keys this module exposes for other modules to consume,
   * e.g. "customers:findOne". Optional and additive — a descriptor that
   * omits this field simply exposes nothing new beyond whatever cross-
   * module NestJS imports already exist today. Non-Core modules must
   * prefix every key with their own module id, same rule as
   * `permissionKeys` (enforced in validateDescriptors()).
   */
  providesCapabilities?: string[];
  /**
   * Capability keys this module declares it consumes from other modules
   * (CLAUDE.md Decision #7 §7's "explicitly exported interfaces").
   * Optional and additive: a descriptor that omits this field is not
   * validated against it at all — existing modules keep working
   * unchanged until they opt in. Once declared, every entry must be
   * provided by some other descriptor's `providesCapabilities`
   * (validateDescriptors() checks this at registration time).
   */
  requiresCapabilities?: string[];
  /**
   * NestJS `@Controller()` path prefixes this module owns, e.g.
   * "modules/calendar/events" for Calendar's existing controller.
   * Optional and additive — purely declared, checkable metadata
   * (CLAUDE.md Decision #7 §8's "API routes" registry); it does not
   * change how NestJS actually wires routes (still compile-time
   * controller imports into AppModule, unchanged by this field). Every
   * non-core module's declared prefixes must live under "modules/<id>",
   * matching the convention Calendar already uses, and no two
   * descriptors may declare the exact same prefix
   * (validateDescriptors() checks both at registration time).
   */
  routePrefixes?: string[];
}
