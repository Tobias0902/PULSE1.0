import { createZodDto } from "nestjs-zod";
import { createOrganizationSchema } from "@pulse/domain";

export class CreateOrganizationDto extends createZodDto(createOrganizationSchema) {}
