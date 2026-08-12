import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ModuleActiveGuard } from "./module-active.guard";
import { ModuleActivationService } from "../module-activation.service";

function makeContext(user: { organizationId: string } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => {},
    getClass: () => {},
  } as unknown as ExecutionContext;
}

describe("ModuleActiveGuard", () => {
  it("allows access when no module is required", async () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const activationService = { isActiveForOrg: jest.fn() } as unknown as ModuleActivationService;
    const guard = new ModuleActiveGuard(reflector, activationService);
    await expect(guard.canActivate(makeContext({ organizationId: "org-1" }))).resolves.toBe(true);
    expect(activationService.isActiveForOrg).not.toHaveBeenCalled();
  });

  it("allows access when the required module is active for the caller's organization", async () => {
    const reflector = { getAllAndOverride: () => "crm" } as unknown as Reflector;
    const activationService = {
      isActiveForOrg: jest.fn().mockResolvedValue(true),
    } as unknown as ModuleActivationService;
    const guard = new ModuleActiveGuard(reflector, activationService);
    await expect(guard.canActivate(makeContext({ organizationId: "org-1" }))).resolves.toBe(true);
    expect(activationService.isActiveForOrg).toHaveBeenCalledWith("org-1", "crm");
  });

  it("denies access when the required module is not active for the caller's organization", async () => {
    const reflector = { getAllAndOverride: () => "crm" } as unknown as Reflector;
    const activationService = {
      isActiveForOrg: jest.fn().mockResolvedValue(false),
    } as unknown as ModuleActivationService;
    const guard = new ModuleActiveGuard(reflector, activationService);
    await expect(guard.canActivate(makeContext({ organizationId: "org-1" }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("denies access when there is no authenticated user on the request", async () => {
    const reflector = { getAllAndOverride: () => "crm" } as unknown as Reflector;
    const activationService = { isActiveForOrg: jest.fn() } as unknown as ModuleActivationService;
    const guard = new ModuleActiveGuard(reflector, activationService);
    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(false);
  });
});
