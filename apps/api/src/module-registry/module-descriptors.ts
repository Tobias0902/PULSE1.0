import { ModuleDescriptor } from "@pulse/module-contracts";
import { PERMISSION_KEYS } from "@pulse/domain";
import { CALENDAR_MODULE_DESCRIPTOR } from "../modules/calendar/calendar.descriptor";

// Every module compiled into this installation, listed by hand — modules
// stay compile-time NestJS imports (CLAUDE.md Decision #7 §12), so this
// aggregation point necessarily knows each module by name, the same way
// AppModule's own imports array does. That is a bootstrap/wiring concern,
// not the kind of "Core hardcodes module business logic" Decision #7 §8
// warns against.
export const MODULE_DESCRIPTORS: ModuleDescriptor[] = [
  {
    id: "core",
    name: "PULSE-Core",
    version: "0.0.0",
    sdkVersion: "1",
    isCore: true,
    dependsOn: [],
    permissionKeys: [...PERMISSION_KEYS],
    postgresSchema: "core",
    migrationsFolder: "./drizzle",
    // What Core actually exposes for other modules to consume in-process
    // (MODULE_SDK_DESIGN.md §5) — currently just the two capabilities
    // Calendar depends on (CUSTOMERS_FIND_ONE/LOCATIONS_FIND_ONE tokens).
    providesCapabilities: ["customers:findOne", "locations:findOne"],
  },
  CALENDAR_MODULE_DESCRIPTOR,
];
