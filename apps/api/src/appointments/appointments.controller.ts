import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto";

@ApiTags("appointments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @RequirePermissions("appointment:write")
  create(@Body() body: CreateAppointmentDto, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.create(body, user.sub, user.organizationId);
  }

  @Get()
  @RequirePermissions("appointment:read")
  findAll(@Query("caseId") caseId: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.findByCase(caseId, user.organizationId);
  }

  @Get(":id")
  @RequirePermissions("appointment:read")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.findOne(id, user.organizationId);
  }

  @Get(":id/trace")
  @RequirePermissions("appointment:read")
  trace(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.trace(id, user.organizationId);
  }
}
