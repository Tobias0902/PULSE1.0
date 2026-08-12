import { z } from "zod";
import { uuidSchema } from "./common.js";

// Installation-wide catalog row (see CLAUDE.md Decision #7): what module
// code this installation has compiled in, synced from the compiled
// descriptor list at boot. Not an audited entity in the usual sense — it
// has no createdBy/updatedBy, only a discovery timestamp.
export const moduleSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  version: z.string(),
  sdkVersion: z.string(),
  isCore: z.boolean(),
  dependsOn: z.array(z.string()),
  postgresSchema: z.string().nullable(),
  discoveredAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ModuleCatalogEntry = z.infer<typeof moduleSchema>;

// Per-organization activation state for one module. "Activation" gates
// access to an already-compiled module for one organization — it is never
// runtime code loading (see @pulse/module-contracts).
export const organizationModuleSchema = z.object({
  organizationId: uuidSchema,
  moduleId: z.string().min(1),
  isActive: z.boolean(),
  config: z.record(z.unknown()),
  activatedAt: z.string().datetime().nullable(),
  activatedBy: uuidSchema.nullable(),
  deactivatedAt: z.string().datetime().nullable(),
  deactivatedBy: uuidSchema.nullable(),
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrganizationModule = z.infer<typeof organizationModuleSchema>;

export const updateOrganizationModuleSchema = z.object({
  isActive: z.boolean(),
  version: z.number().int().nonnegative(),
});
export type UpdateOrganizationModuleInput = z.infer<typeof updateOrganizationModuleSchema>;
