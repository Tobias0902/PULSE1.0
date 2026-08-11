import { createZodDto } from "nestjs-zod";
import { loginRequestSchema, refreshRequestSchema } from "@pulse/domain";

export class LoginDto extends createZodDto(loginRequestSchema) {}
export class RefreshDto extends createZodDto(refreshRequestSchema) {}
