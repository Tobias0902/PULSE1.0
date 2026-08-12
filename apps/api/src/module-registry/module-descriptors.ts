import { ModuleDescriptor } from "@pulse/module-contracts";
import { PERMISSION_KEYS } from "@pulse/domain";

// The only module compiled into this installation is Core itself — no
// business module (CRM/QM/AI/...) exists yet. This is where a real future
// module's descriptor gets added; see packages/module-contracts and
// CLAUDE.md Decision #7.
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
  },
];
