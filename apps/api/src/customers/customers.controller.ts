import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
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
    // organizationId is never taken from the client body: a caller could
    // otherwise attach a customer to any organization by guessing its id.
    return this.customersService.create({ ...body, organizationId: user.organizationId }, user.sub);
  }

  @Get()
  @RequirePermissions("customer:read")
  findAll(@CurrentUser() user: JwtPayload) {
    return this.customersService.findByOrganization(user.organizationId);
  }

  @Get(":id")
  @RequirePermissions("customer:read")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.customersService.findOne(id, user.organizationId);
  }

  @Patch(":id")
  @RequirePermissions("customer:write")
  update(@Param("id") id: string, @Body() body: UpdateCustomerDto, @CurrentUser() user: JwtPayload) {
    return this.customersService.update(id, body, user.sub, user.organizationId);
  }
}
