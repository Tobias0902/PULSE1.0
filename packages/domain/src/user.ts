import { z } from "zod";
import { auditedFieldsSchema, uuidSchema } from "./common.js";

export const createUserSchema = z.object({
  organizationId: uuidSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  password: z.string().min(12).max(200),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const userSchema = auditedFieldsSchema.extend({
  organizationId: uuidSchema,
  email: z.string().email(),
  displayName: z.string(),
  isActive: z.boolean(),
});
export type User = z.infer<typeof userSchema>;
