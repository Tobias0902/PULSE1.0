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

  it("accepts descriptors that omit providesCapabilities/requiresCapabilities entirely", () => {
    expect(() => validateDescriptors([descriptor({})])).not.toThrow();
  });

  it("accepts a module requiring a capability another module provides", () => {
    expect(() =>
      validateDescriptors([
        descriptor({ providesCapabilities: ["customers:findOne"] }),
        descriptor({ id: "calendar", isCore: false, requiresCapabilities: ["customers:findOne"] }),
      ]),
    ).not.toThrow();
  });

  it("rejects a module requiring a capability no module provides", () => {
    expect(() =>
      validateDescriptors([
        descriptor({ id: "calendar", isCore: false, requiresCapabilities: ["customers:findOne"] }),
      ]),
    ).toThrow(/requires capability "customers:findOne", which no registered module provides/);
  });

  it("rejects a non-core module declaring an unprefixed capability key", () => {
    expect(() =>
      validateDescriptors([
        descriptor({ id: "crm", isCore: false, providesCapabilities: ["contact:findOne"] }),
      ]),
    ).toThrow(/must be prefixed/);
  });

  it("accepts descriptors that omit routePrefixes entirely", () => {
    expect(() => validateDescriptors([descriptor({})])).not.toThrow();
  });

  it("accepts a non-core module declaring a route prefix under its own modules/<id> namespace", () => {
    expect(() =>
      validateDescriptors([
        descriptor({ id: "calendar", isCore: false, routePrefixes: ["modules/calendar/events"] }),
      ]),
    ).not.toThrow();
  });

  it("rejects a non-core module declaring a route prefix outside its own namespace", () => {
    expect(() =>
      validateDescriptors([descriptor({ id: "calendar", isCore: false, routePrefixes: ["customers"] })]),
    ).toThrow(/must live under "modules\/calendar"/);
  });

  it("rejects two descriptors declaring the same route prefix", () => {
    // Core declares it first (Core is exempt from the modules/<id> namespace
    // check), so this isolates the duplicate-prefix check from the
    // namespace check — two non-core ids could never legitimately collide
    // on the same literal prefix in the first place, since each one's
    // prefix is constrained to its own "modules/<id>" namespace.
    expect(() =>
      validateDescriptors([
        descriptor({ routePrefixes: ["modules/calendar/events"] }),
        descriptor({ id: "calendar", isCore: false, routePrefixes: ["modules/calendar/events"] }),
      ]),
    ).toThrow(/declared by more than one module/);
  });
});
