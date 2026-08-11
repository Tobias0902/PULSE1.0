import { SetMetadata } from "@nestjs/common";
import { PermissionKey } from "@pulse/domain";

export const PERMISSIONS_KEY = "requiredPermissions";

export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
