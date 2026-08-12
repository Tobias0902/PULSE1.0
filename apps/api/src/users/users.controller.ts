import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
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
    // organizationId is never taken from the client body — see the same
    // note on CustomersController.create.
    return this.usersService.create({ ...body, organizationId: user.organizationId }, user.sub);
  }

  @Get()
  @RequirePermissions("user:read")
  findAll(@CurrentUser() user: JwtPayload) {
    return this.usersService.findByOrganization(user.organizationId);
  }
}
