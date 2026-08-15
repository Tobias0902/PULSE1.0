import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LocationsController } from "./locations.controller";
import { LocationsService } from "./locations.service";
import { LOCATIONS_FIND_ONE } from "./locations.capability";

@Module({
  imports: [AuthModule],
  controllers: [LocationsController],
  providers: [LocationsService, { provide: LOCATIONS_FIND_ONE, useExisting: LocationsService }],
  // See customers.module.ts's doc comment — same pattern.
  exports: [LocationsService, LOCATIONS_FIND_ONE],
})
export class LocationsModule {}
