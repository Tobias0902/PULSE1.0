import { Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { ModuleRegistryService } from "./module-registry.service";
import { ModuleActivationService } from "./module-activation.service";
import { UpdateOrganizationModuleDto } from "./dto";

@ApiTags("modules")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class OrganizationModulesController {
  constructor(
    private readonly moduleRegistryService: ModuleRegistryService,
    private readonly moduleActivationService: ModuleActivationService,
  ) {}

  @Get("modules")
  @RequirePermissions("module:read")
  listCatalog() {
    return this.moduleRegistryService.listAll();
  }

  @Get("organizations/:id/modules")
  @RequirePermissions("module:read")
  listForOrganization(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    assertOwnOrganization(id, user);
    return this.moduleActivationService.listForOrganization(id);
  }

  @Put("organizations/:id/modules/:moduleId")
  @RequirePermissions("module:write")
  setActivation(
    @Param("id") id: string,
    @Param("moduleId") moduleId: string,
    @Body() body: UpdateOrganizationModuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    assertOwnOrganization(id, user);
    return this.moduleActivationService.setActivation(id, moduleId, body.isActive, body.version, user.sub);
  }
}

// A user's JWT only ever carries one organizationId — see the same note on
// OrganizationsService.findOne. 404, not 403, so a foreign org id doesn't
// even confirm existence.
function assertOwnOrganization(id: string, user: JwtPayload): void {
  if (id !== user.organizationId) throw new NotFoundException("Organization not found.");
}
