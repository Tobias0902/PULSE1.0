import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { AssistiveDevicesService } from "./assistive-devices.service";
import { CreateAssistiveDeviceDto } from "./dto";

@ApiTags("assistive-devices")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("assistive-devices")
export class AssistiveDevicesController {
  constructor(private readonly assistiveDevicesService: AssistiveDevicesService) {}

  @Post()
  @RequirePermissions("assistiveDevice:write")
  create(@Body() body: CreateAssistiveDeviceDto, @CurrentUser() user: JwtPayload) {
    return this.assistiveDevicesService.create(body, user.sub);
  }

  @Get()
  @RequirePermissions("assistiveDevice:read")
  findAll(@Query("customerId") customerId: string) {
    return this.assistiveDevicesService.findByCustomer(customerId);
  }

  @Get(":id")
  @RequirePermissions("assistiveDevice:read")
  findOne(@Param("id") id: string) {
    return this.assistiveDevicesService.findOne(id);
  }
}
