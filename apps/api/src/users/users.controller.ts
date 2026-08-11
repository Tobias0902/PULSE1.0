import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions("user:write")
  create(@Body() body: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.create(body, user.sub);
  }

  @Get()
  @RequirePermissions("user:read")
  findAll(@Query("organizationId") organizationId: string) {
    return this.usersService.findByOrganization(organizationId);
  }
}
