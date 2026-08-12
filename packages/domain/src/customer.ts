import { z } from "zod";
import { auditedFieldsSchema, uuidSchema } from "./common.js";

// organizationId is deliberately absent: it is always derived server-side
// from the caller's own session, never accepted from the client (see
// CustomersController.create).
export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().nullable().default(null),
  phone: z.string().max(50).nullable().default(null),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  version: z.number().int().nonnegative(),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerSchema = auditedFieldsSchema.extend({
  organizationId: uuidSchema,
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export type Customer = z.infer<typeof customerSchema>;
