import { describe, expect, it } from "vitest";
import { createCaseSchema } from "./case.js";

describe("createCaseSchema", () => {
  it("accepts an arbitrary, non-enumerated case type", () => {
    // PULSE-Core must stay industry-neutral: "type" is free text so LimbArt
    // examples such as "maintenance"/"repair"/"new supply" are just data,
    // never hardcoded system-defined case types.
    const result = createCaseSchema.parse({
      assistiveDeviceId: "3c2f2c9e-8e2d-4b8a-9b8a-6a1e2f3d4c5b",
      title: "Whatever a customer calls it",
      type: "some-completely-arbitrary-workflow-label",
    });
    expect(result.type).toBe("some-completely-arbitrary-workflow-label");
  });

  it("defaults status to a neutral value", () => {
    const result = createCaseSchema.parse({
      assistiveDeviceId: "3c2f2c9e-8e2d-4b8a-9b8a-6a1e2f3d4c5b",
      title: "New case",
    });
    expect(result.status).toBe("open");
    expect(result.type).toBeNull();
  });

  it("rejects a missing assistiveDeviceId", () => {
    expect(() => createCaseSchema.parse({ title: "New case" })).toThrow();
  });
});
