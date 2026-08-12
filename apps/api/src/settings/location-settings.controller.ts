import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { LocationSettingsService } from "./location-settings.service";
import { UpdateLocationSettingsDto } from "./dto";

@ApiTags("locations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("locations/:id/settings")
export class LocationSettingsController {
  constructor(private readonly locationSettingsService: LocationSettingsService) {}

  @Get()
  @RequirePermissions("location:read")
  find(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.locationSettingsService.find(id, user.organizationId);
  }

  @Put()
  @RequirePermissions("location:write")
  update(@Param("id") id: string, @Body() body: UpdateLocationSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.locationSettingsService.update(id, user.organizationId, body, user.sub);
  }
}
