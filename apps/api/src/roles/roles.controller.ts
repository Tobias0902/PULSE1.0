import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto";

@ApiTags("roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermissions("role:write")
  create(@Body() body: CreateRoleDto, @CurrentUser() user: JwtPayload) {
    return this.rolesService.create(body, user.sub, user.organizationId);
  }

  @Get()
  @RequirePermissions("role:read")
  findAll(@CurrentUser() user: JwtPayload) {
    return this.rolesService.findByOrganization(user.organizationId);
  }
}
