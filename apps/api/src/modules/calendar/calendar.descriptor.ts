import { ModuleDescriptor } from "@pulse/module-contracts";

// PULSE Calendar — the platform-wide appointment/event authority
// (CLAUDE.md Decision #9). This iteration: calendar_events CRUD on one's
// own calendar only. No participants, recurrence, cross-user access, or
// cross-module projection subscriber yet — see the implementation plan.
export const CALENDAR_MODULE_DESCRIPTOR: ModuleDescriptor = {
  id: "calendar",
  name: "PULSE Calendar",
  version: "0.0.1",
  sdkVersion: "1",
  isCore: false,
  dependsOn: [],
  permissionKeys: ["calendar:read:own", "calendar:write:own"],
  postgresSchema: "calendar",
  migrationsFolder: "./src/modules/calendar/database/drizzle",
};
