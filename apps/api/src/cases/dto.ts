import { createZodDto } from "nestjs-zod";
import { createCaseSchema, updateCaseSchema } from "@pulse/domain";

export class CreateCaseDto extends createZodDto(createCaseSchema) {}
export class UpdateCaseDto extends createZodDto(updateCaseSchema) {}
