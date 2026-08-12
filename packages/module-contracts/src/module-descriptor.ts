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
}
