import { z } from "zod";
import { auditedFieldsSchema, uuidSchema } from "./common.js";
import { caseSchema } from "./case.js";
import { assistiveDeviceSchema } from "./assistive-device.js";
import { customerSchema } from "./customer.js";

export const createAppointmentSchema = z.object({
  caseId: uuidSchema,
  scheduledAt: z.string().datetime(),
  notes: z.string().max(5000).nullable().default(null),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const appointmentSchema = auditedFieldsSchema.extend({
  caseId: uuidSchema,
  scheduledAt: z.string().datetime(),
  notes: z.string().nullable(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

// Full Customer -> AssistiveDevice -> Case -> Appointment traceability chain,
// returned by GET /appointments/:id/trace to make traceability directly
// demonstrable end to end.
export const appointmentTraceSchema = z.object({
  appointment: appointmentSchema,
  case: caseSchema,
  assistiveDevice: assistiveDeviceSchema,
  customer: customerSchema,
});
export type AppointmentTrace = z.infer<typeof appointmentTraceSchema>;
