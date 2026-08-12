import { z } from "zod";
import { uuidSchema } from "./common.js";

// A calendar event's destination is one of four explicit kinds rather than
// a single free-text string. "customerAddress"/"coreLocation" store only a
// stable reference — never the resolved address text — so Calendar never
// duplicates data CRM/Core owns; "external" is the one kind Calendar
// itself is the source of truth for, since the user typed it directly
// into Calendar. Resolving a reference into a navigable address (and
// choosing a maps provider) is a client/integration-layer concern, never
// Calendar's.
export const calendarEventLocationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("customerAddress"), customerId: uuidSchema }),
  z.object({ type: z.literal("coreLocation"), locationId: uuidSchema }),
  z.object({
    type: z.literal("external"),
    name: z.string().max(200).nullable().default(null),
    address: z.string().max(500).nullable().default(null),
  }),
  z.object({ type: z.literal("remote") }),
]);
export type CalendarEventLocation = z.infer<typeof calendarEventLocationSchema>;

// Not extended from auditedFieldsSchema: Calendar is a module with its own
// schema/package boundary (CLAUDE.md Decision #9), not a Core entity.
// organizationId/ownerUserId are set server-side, never accepted from the
// client — see CalendarEventsController.create.
export const createCalendarEventSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).nullable().default(null),
    location: calendarEventLocationSchema.default({ type: "remote" }),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    isAllDay: z.boolean().default(false),
    timezone: z.string().min(1),
    isPrivate: z.boolean().default(false),
    colorTag: z.string().max(50).nullable().default(null),
  })
  .refine((input) => new Date(input.endAt) > new Date(input.startAt), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;

export const updateCalendarEventSchema = z.object({
  version: z.number().int().nonnegative(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  location: calendarEventLocationSchema.optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  isAllDay: z.boolean().optional(),
  timezone: z.string().min(1).optional(),
  isPrivate: z.boolean().optional(),
  status: z.enum(["confirmed", "cancelled"]).optional(),
  colorTag: z.string().max(50).nullable().optional(),
});
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;

export const calendarEventSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  ownerUserId: uuidSchema,
  title: z.string(),
  description: z.string().nullable(),
  location: calendarEventLocationSchema,
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  isAllDay: z.boolean(),
  timezone: z.string(),
  isPrivate: z.boolean(),
  status: z.string(),
  colorTag: z.string().nullable(),
  sourceModuleId: z.string(),
  sourceEntityType: z.string().nullable(),
  sourceEntityId: z.string().nullable(),
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: uuidSchema.nullable(),
  updatedBy: uuidSchema.nullable(),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
