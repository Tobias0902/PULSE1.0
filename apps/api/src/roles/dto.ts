import { createZodDto } from "nestjs-zod";
import { createRoleSchema } from "@pulse/domain";

export class CreateRoleDto extends createZodDto(createRoleSchema) {}
