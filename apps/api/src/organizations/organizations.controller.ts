import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto";

@ApiTags("organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @RequirePermissions("organization:write")
  create(@Body() body: CreateOrganizationDto, @CurrentUser() user: JwtPayload) {
    return this.organizationsService.create(body, user.sub);
  }

  @Get()
  @RequirePermissions("organization:read")
  findAll(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.findAll(user.organizationId);
  }

  @Get(":id")
  @RequirePermissions("organization:read")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.organizationsService.findOne(id, user.organizationId);
  }
}
