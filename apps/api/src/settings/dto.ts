import { createZodDto } from "nestjs-zod";
import { updateOrganizationSettingsSchema, updateLocationSettingsSchema } from "@pulse/domain";

export class UpdateOrganizationSettingsDto extends createZodDto(updateOrganizationSettingsSchema) {}
export class UpdateLocationSettingsDto extends createZodDto(updateLocationSettingsSchema) {}
