import { createZodDto } from "nestjs-zod";
import { updateOrganizationModuleSchema } from "@pulse/domain";

export class UpdateOrganizationModuleDto extends createZodDto(updateOrganizationModuleSchema) {}
