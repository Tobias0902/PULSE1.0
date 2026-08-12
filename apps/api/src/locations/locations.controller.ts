import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { LocationsService } from "./locations.service";
import { CreateLocationDto } from "./dto";

@ApiTags("locations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("locations")
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @RequirePermissions("location:write")
  create(@Body() body: CreateLocationDto, @CurrentUser() user: JwtPayload) {
    // organizationId is never taken from the client body — see the same
    // note on CustomersController.create.
    return this.locationsService.create({ ...body, organizationId: user.organizationId }, user.sub);
  }

  @Get()
  @RequirePermissions("location:read")
  findAll(@CurrentUser() user: JwtPayload) {
    return this.locationsService.findByOrganization(user.organizationId);
  }
}
