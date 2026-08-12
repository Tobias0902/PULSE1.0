import { createZodDto } from "nestjs-zod";
import { createCalendarEventSchema, updateCalendarEventSchema } from "@pulse/domain";

export class CreateCalendarEventDto extends createZodDto(createCalendarEventSchema) {}
export class UpdateCalendarEventDto extends createZodDto(updateCalendarEventSchema) {}
