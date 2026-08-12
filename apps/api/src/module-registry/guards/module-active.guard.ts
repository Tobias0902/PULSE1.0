import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtPayload } from "../../auth/jwt-payload";
import { ModuleActivationService } from "../module-activation.service";
import { REQUIRE_MODULE_KEY } from "../decorators/require-module.decorator";

@Injectable()
export class ModuleActiveGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleActivationService: ModuleActivationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleId = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduleId) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) return false;

    const active = await this.moduleActivationService.isActiveForOrg(user.organizationId, moduleId);
    if (!active) {
      throw new ForbiddenException(`Module "${moduleId}" is not active for this organization.`);
    }
    return true;
  }
}
