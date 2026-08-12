import { z } from "zod";
import { auditedFieldsSchema, uuidSchema } from "./common.js";

// deviceType is deliberately free text, not an enum: PULSE-Core must stay
// industry-neutral. Orthopaedic-specific device categories are configuration
// or module data, never hardcoded here.
export const createAssistiveDeviceSchema = z.object({
  customerId: uuidSchema,
  label: z.string().min(1).max(200),
  deviceType: z.string().max(200).nullable().default(null),
});
export type CreateAssistiveDeviceInput = z.infer<typeof createAssistiveDeviceSchema>;

export const assistiveDeviceSchema = auditedFieldsSchema.extend({
  organizationId: uuidSchema,
  customerId: uuidSchema,
  label: z.string(),
  deviceType: z.string().nullable(),
});
export type AssistiveDevice = z.infer<typeof assistiveDeviceSchema>;
