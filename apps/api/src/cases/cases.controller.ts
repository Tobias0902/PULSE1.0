import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/jwt-payload";
import { CasesService } from "./cases.service";
import { CreateCaseDto, UpdateCaseDto } from "./dto";

@ApiTags("cases")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("cases")
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @RequirePermissions("case:write")
  create(@Body() body: CreateCaseDto, @CurrentUser() user: JwtPayload) {
    return this.casesService.create(body, user.sub, user.organizationId);
  }

  @Get()
  @RequirePermissions("case:read")
  findAll(@Query("assistiveDeviceId") assistiveDeviceId: string, @CurrentUser() user: JwtPayload) {
    return this.casesService.findByAssistiveDevice(assistiveDeviceId, user.organizationId);
  }

  @Get(":id")
  @RequirePermissions("case:read")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.casesService.findOne(id, user.organizationId);
  }

  @Patch(":id")
  @RequirePermissions("case:write")
  update(@Param("id") id: string, @Body() body: UpdateCaseDto, @CurrentUser() user: JwtPayload) {
    return this.casesService.update(id, body, user.sub, user.organizationId);
  }
}
