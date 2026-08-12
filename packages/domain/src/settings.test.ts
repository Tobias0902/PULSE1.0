import { describe, expect, it } from "vitest";
import { mergeSettings } from "./settings.js";

describe("mergeSettings", () => {
  it("lets location terminology override the organization's for the same key", () => {
    const result = mergeSettings(
      { terminology: { case: "Fallakte" }, features: {} },
      { terminology: { case: "Auftrag" }, features: {} },
    );
    expect(result.terminology.case).toBe("Auftrag");
  });

  it("keeps organization-level keys the location does not override", () => {
    const result = mergeSettings(
      { terminology: { case: "Fallakte", customer: "Kunde" }, features: {} },
      { terminology: { case: "Auftrag" }, features: {} },
    );
    expect(result.terminology.customer).toBe("Kunde");
  });

  it("merges feature flags the same way", () => {
    const result = mergeSettings(
      { terminology: {}, features: { "crm.enabled": true, "qm.enabled": false } },
      { terminology: {}, features: { "qm.enabled": true } },
    );
    expect(result.features).toEqual({ "crm.enabled": true, "qm.enabled": true });
  });
});
