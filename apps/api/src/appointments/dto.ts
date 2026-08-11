import { createZodDto } from "nestjs-zod";
import { createAppointmentSchema } from "@pulse/domain";

export class CreateAppointmentDto extends createZodDto(createAppointmentSchema) {}
