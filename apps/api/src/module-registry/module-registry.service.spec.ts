import { ModuleDescriptor } from "@pulse/module-contracts";
import { validateDescriptors } from "./module-registry.service";

function descriptor(overrides: Partial<ModuleDescriptor>): ModuleDescriptor {
  return {
    id: "core",
    name: "PULSE-Core",
    version: "0.0.0",
    sdkVersion: "1",
    isCore: true,
    dependsOn: [],
    permissionKeys: [],
    postgresSchema: "core",
    migrationsFolder: "./drizzle",
    ...overrides,
  };
}

describe("validateDescriptors", () => {
  it("accepts a valid descriptor set", () => {
    expect(() =>
      validateDescriptors([descriptor({ permissionKeys: ["organization:read"] })]),
    ).not.toThrow();
  });

  it("rejects a descriptor targeting an unsupported SDK version", () => {
    expect(() => validateDescriptors([descriptor({ sdkVersion: "999" })])).toThrow(/SDK version/);
  });

  it("rejects a non-core module declaring an unprefixed permission key", () => {
    expect(() =>
      validateDescriptors([
        descriptor({ id: "crm", isCore: false, permissionKeys: ["contact:read"] }),
      ]),
    ).toThrow(/must be prefixed/);
  });

  it("accepts a non-core module declaring a properly prefixed permission key", () => {
    expect(() =>
      validateDescriptors([
        descriptor({ id: "crm", isCore: false, permissionKeys: ["crm:contact:read"] }),
      ]),
    ).not.toThrow();
  });

  it("rejects two descriptors declaring the same module id", () => {
    expect(() =>
      validateDescriptors([
        descriptor({ id: "crm", isCore: false, permissionKeys: ["crm:contact:read"] }),
        descriptor({ id: "crm", isCore: false, permissionKeys: ["crm:deal:read"] }),
      ]),
    ).toThrow(/Duplicate module id/);
  });
});
