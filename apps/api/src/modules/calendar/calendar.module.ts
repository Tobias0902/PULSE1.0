import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { ModuleRegistryModule } from "../../module-registry/module-registry.module";
import { CustomersModule } from "../../customers/customers.module";
import { LocationsModule } from "../../locations/locations.module";
import { CalendarEventsController } from "./calendar-events.controller";
import { CalendarEventsService } from "./calendar-events.service";

@Module({
  // ModuleRegistryModule supplies ModuleActiveGuard, used by every
  // Calendar route alongside PermissionsGuard — activation and permission
  // are two independent gates (see the guard's own doc comment).
  // CustomersModule/LocationsModule still need to be imported for NestJS
  // to resolve their exported tokens, but CalendarEventsService itself now
  // only ever injects their narrow CUSTOMERS_FIND_ONE/LOCATIONS_FIND_ONE
  // capability tokens (MODULE_SDK_DESIGN.md §5/§6), not the full
  // CustomersService/LocationsService classes, to validate a
  // customerAddress/coreLocation reference belongs to the caller's own
  // organization — Calendar never queries Core's tables directly.
  imports: [AuthModule, ModuleRegistryModule, CustomersModule, LocationsModule],
  controllers: [CalendarEventsController],
  providers: [CalendarEventsService],
})
export class CalendarModule {}
