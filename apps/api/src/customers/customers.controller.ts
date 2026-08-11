import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto";

@ApiTags("customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions("customer:write")
  create(@Body() body: CreateCustomerDto, @CurrentUser() user: JwtPayload) {
    return this.customersService.create(body, user.sub);
  }

  @Get()
  @RequirePermissions("customer:read")
  findAll(@Query("organizationId") organizationId: string) {
    return this.customersService.findByOrganization(organizationId);
  }

  @Get(":id")
  @RequirePermissions("customer:read")
  findOne(@Param("id") id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(":id")
  @RequirePermissions("customer:write")
  update(@Param("id") id: string, @Body() body: UpdateCustomerDto, @CurrentUser() user: JwtPayload) {
    return this.customersService.update(id, body, user.sub);
  }
}
