import { z } from "zod";
import { auditedFieldsSchema } from "./common.js";

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const organizationSchema = auditedFieldsSchema.extend({
  name: z.string(),
});
export type Organization = z.infer<typeof organizationSchema>;
