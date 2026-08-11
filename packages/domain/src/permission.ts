import { z } from "zod";
import { uuidSchema } from "./common.js";

// Placeholder catalog for this foundation iteration only — NOT the final
// Decision #4 permission catalog (that remains an open decision).
export const permissionSchema = z.object({
  id: uuidSchema,
  key: z.string(),
  description: z.string(),
});
export type Permission = z.infer<typeof permissionSchema>;
