import { z } from "zod";
import { auditedFieldsSchema, uuidSchema } from "./common.js";

// `type` is free text, not an enum: case types such as "maintenance",
// "repair", or "new supply" are LimbArt examples only and must never be
// hardcoded as system-defined case types (see CLAUDE.md). `status` is a
// plain string too — configurable boards/workflows come later.
export const createCaseSchema = z.object({
  assistiveDeviceId: uuidSchema,
  title: z.string().min(1).max(200),
  type: z.string().max(200).nullable().default(null),
  status: z.string().max(100).default("open"),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const updateCaseSchema = z.object({
  version: z.number().int().nonnegative(),
  title: z.string().min(1).max(200).optional(),
  type: z.string().max(200).nullable().optional(),
  status: z.string().max(100).optional(),
});
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

export const caseSchema = auditedFieldsSchema.extend({
  organizationId: uuidSchema,
  assistiveDeviceId: uuidSchema,
  title: z.string(),
  type: z.string().nullable(),
  status: z.string(),
});
export type Case = z.infer<typeof caseSchema>;
