import { Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { OrganizationSettingsService } from "./organization-settings.service";
import { UpdateOrganizationSettingsDto } from "./dto";

@ApiTags("organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/:id/settings")
export class OrganizationSettingsController {
  constructor(private readonly organizationSettingsService: OrganizationSettingsService) {}

  @Get()
  @RequirePermissions("organization:read")
  find(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    assertOwnOrganization(id, user);
    return this.organizationSettingsService.find(id);
  }

  @Put()
  @RequirePermissions("organization:write")
  update(@Param("id") id: string, @Body() body: UpdateOrganizationSettingsDto, @CurrentUser() user: JwtPayload) {
    assertOwnOrganization(id, user);
    return this.organizationSettingsService.update(id, body, user.sub);
  }
}

// A user's JWT only ever carries one organizationId — see the same note on
// OrganizationsService.findOne. 404, not 403, so a foreign org id doesn't
// even confirm existence.
function assertOwnOrganization(id: string, user: JwtPayload): void {
  if (id !== user.organizationId) throw new NotFoundException("Organization not found.");
}
