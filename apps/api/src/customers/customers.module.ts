import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { CUSTOMERS_FIND_ONE } from "./customers.capability";

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [CustomersService, { provide: CUSTOMERS_FIND_ONE, useExisting: CustomersService }],
  // CUSTOMERS_FIND_ONE is the same CustomersService instance, aliased
  // behind the narrow capability token/interface (see
  // customers.capability.ts) — other modules should depend on that token,
  // not the full CustomersService, per CLAUDE.md Decision #7 §7.
  exports: [CustomersService, CUSTOMERS_FIND_ONE],
})
export class CustomersModule {}
