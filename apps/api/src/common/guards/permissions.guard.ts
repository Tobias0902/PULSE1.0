import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { PermissionKey } from "@pulse/domain";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { JwtPayload } from "../../auth/jwt-payload";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const granted = new Set(request.user?.permissions ?? []);
    const missing = required.filter((permission) => !granted.has(permission));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing required permission(s): ${missing.join(", ")}`);
    }
    return true;
  }
}
