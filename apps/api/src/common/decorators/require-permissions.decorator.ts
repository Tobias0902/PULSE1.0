import { SetMetadata } from "@nestjs/common";
import { PermissionKey } from "@pulse/domain";

export const PERMISSIONS_KEY = "requiredPermissions";

// PermissionKey | (string & {}) keeps IDE autocomplete for Core's known
// keys while still accepting a module's own namespaced keys (e.g.
// "calendar:write:own") — those live only on that module's own
// ModuleDescriptor, never registered back into @pulse/domain's closed
// union, so a module controller can declare them without Core's domain
// package needing to know every module that will ever exist.
type AnyPermissionKey = PermissionKey | (string & {});

export const RequirePermissions = (...permissions: AnyPermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
