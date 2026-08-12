import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../../auth/jwt-payload";
import { ModuleActiveGuard } from "../../module-registry/guards/module-active.guard";
import { RequireModule } from "../../module-registry/decorators/require-module.decorator";
import { CalendarEventsService } from "./calendar-events.service";
import { CreateCalendarEventDto, UpdateCalendarEventDto } from "./dto";

@ApiTags("calendar")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("calendar")
@Controller("modules/calendar/events")
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Post()
  @RequirePermissions("calendar:write:own")
  create(@Body() body: CreateCalendarEventDto, @CurrentUser() user: JwtPayload) {
    return this.calendarEventsService.create(body, user.sub, user.organizationId);
  }

  @Get()
  @RequirePermissions("calendar:read:own")
  findAll(@Query("from") from: string | undefined, @Query("to") to: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.calendarEventsService.findByOwner(user.sub, user.organizationId, from, to);
  }

  @Get(":id")
  @RequirePermissions("calendar:read:own")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.calendarEventsService.findOne(id, user.sub, user.organizationId);
  }

  @Patch(":id")
  @RequirePermissions("calendar:write:own")
  update(@Param("id") id: string, @Body() body: UpdateCalendarEventDto, @CurrentUser() user: JwtPayload) {
    return this.calendarEventsService.update(id, body, user.sub, user.organizationId);
  }
}
