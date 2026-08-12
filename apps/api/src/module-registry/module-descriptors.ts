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
  },
  CALENDAR_MODULE_DESCRIPTOR,
];
