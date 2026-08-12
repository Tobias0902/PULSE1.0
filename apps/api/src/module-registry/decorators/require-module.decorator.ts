import { SetMetadata } from "@nestjs/common";

export const REQUIRE_MODULE_KEY = "requiredModule";

// Pairs with @RequirePermissions on module-owned routes: activation gates
// "does this organization even have this feature" and permissions gate
// "can this user use it" — a route needs both guards, never one instead of
// the other.
export const RequireModule = (moduleId: string) => SetMetadata(REQUIRE_MODULE_KEY, moduleId);
