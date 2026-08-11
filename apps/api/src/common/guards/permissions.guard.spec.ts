import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";

function makeContext(user: { permissions: string[] } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => {},
    getClass: () => {},
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  it("allows access when no permissions are required", () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ permissions: [] }))).toBe(true);
  });

  it("allows access when the user holds every required permission", () => {
    const reflector = {
      getAllAndOverride: () => ["case:write"],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ permissions: ["case:write", "case:read"] }))).toBe(true);
  });

  it("denies access when a required permission is missing", () => {
    const reflector = {
      getAllAndOverride: () => ["case:write"],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(makeContext({ permissions: ["case:read"] }))).toThrow(
      ForbiddenException,
    );
  });
});
