import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const auditedFieldsSchema = z.object({
  id: uuidSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: uuidSchema.nullable(),
  updatedBy: uuidSchema.nullable(),
  version: z.number().int().nonnegative(),
});

export type AuditedFields = z.infer<typeof auditedFieldsSchema>;
