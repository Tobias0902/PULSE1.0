import { z } from "zod";
import { uuidSchema } from "./common.js";
import { settingsSchema } from "./settings.js";

export const locationSettingsSchema = z.object({
  locationId: uuidSchema,
  settings: settingsSchema,
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime().nullable(),
  updatedBy: uuidSchema.nullable(),
});
export type LocationSettings = z.infer<typeof locationSettingsSchema>;

export const updateLocationSettingsSchema = z.object({
  settings: settingsSchema,
  version: z.number().int().nonnegative(),
});
export type UpdateLocationSettingsInput = z.infer<typeof updateLocationSettingsSchema>;
