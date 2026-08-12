import { z } from "zod";
import { auditedFieldsSchema, uuidSchema } from "./common.js";

// organizationId is deliberately absent: it is always derived server-side
// from the caller's own session, never accepted from the client (see
// LocationsController.create).
export const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullable().default(null),
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const locationSchema = auditedFieldsSchema.extend({
  organizationId: uuidSchema,
  name: z.string(),
  address: z.string().nullable(),
});
export type Location = z.infer<typeof locationSchema>;
