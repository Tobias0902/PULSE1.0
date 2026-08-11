import { createZodDto } from "nestjs-zod";
import { createCustomerSchema, updateCustomerSchema } from "@pulse/domain";

export class CreateCustomerDto extends createZodDto(createCustomerSchema) {}
export class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}
