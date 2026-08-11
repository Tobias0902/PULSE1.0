import { createZodDto } from "nestjs-zod";
import { createUserSchema } from "@pulse/domain";

export class CreateUserDto extends createZodDto(createUserSchema) {}
