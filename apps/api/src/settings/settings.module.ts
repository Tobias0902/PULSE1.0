import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationSettingsController } from "./organization-settings.controller";
import { OrganizationSettingsService } from "./organization-settings.service";
import { LocationSettingsController } from "./location-settings.controller";
import { LocationSettingsService } from "./location-settings.service";

@Module({
  imports: [AuthModule],
  controllers: [OrganizationSettingsController, LocationSettingsController],
  providers: [OrganizationSettingsService, LocationSettingsService],
})
export class SettingsModule {}
