import { z } from "zod";
import { auditedFieldsSchema, uuidSchema } from "./common.js";

// organizationId is deliberately absent: it is always derived server-side
// from the caller's own session, never accepted from the client (see
// RolesController.create).
export const createRoleSchema = z.object({
  name: z.string().min(1).max(200),
  permissionIds: z.array(uuidSchema).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const roleSchema = auditedFieldsSchema.extend({
  organizationId: uuidSchema,
  name: z.string(),
  permissionIds: z.array(uuidSchema),
});
export type Role = z.infer<typeof roleSchema>;
