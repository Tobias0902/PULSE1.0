import { z } from "zod";
import { uuidSchema } from "./common.js";
import { settingsSchema } from "./settings.js";

// Not extended from auditedFieldsSchema: this is a single settings blob
// keyed by organizationId (see apps/api schema), not a normal audited
// entity with its own id/createdBy.
export const organizationSettingsSchema = z.object({
  organizationId: uuidSchema,
  settings: settingsSchema,
  version: z.number().int().nonnegative(),
  // Null when no row has ever been written yet — a fresh organization has
  // default (empty) settings without anyone needing to explicitly create
  // a row for it.
  updatedAt: z.string().datetime().nullable(),
  updatedBy: uuidSchema.nullable(),
});
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export const updateOrganizationSettingsSchema = z.object({
  settings: settingsSchema,
  version: z.number().int().nonnegative(),
});
export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;
