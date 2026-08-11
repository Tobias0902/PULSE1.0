import { createZodDto } from "nestjs-zod";
import { createAssistiveDeviceSchema } from "@pulse/domain";

export class CreateAssistiveDeviceDto extends createZodDto(createAssistiveDeviceSchema) {}
