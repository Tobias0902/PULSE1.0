import { createZodDto } from "nestjs-zod";
import { createLocationSchema } from "@pulse/domain";

export class CreateLocationDto extends createZodDto(createLocationSchema) {}
