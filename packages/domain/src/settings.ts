import { z } from "zod";

// The shape of a settings blob shared by organization- and location-level
// settings (CLAUDE.md Decision #7 §1: "organization/company configuration"
// is a Core primitive). Core validates this shape but never interprets the
// values — terminology overrides and feature flags are free-form data a
// customer or a future module defines, never a fixed enum PULSE-Core knows
// about.
export const settingsSchema = z.object({
  // Free-form label overrides, e.g. { "case": "Fallakte" }. Never a
  // hardcoded enum of PULSE-recognized industry terms.
  terminology: z.record(z.string()).default({}),
  // Namespaced boolean flags, e.g. { "crm.someToggle": true }. Core never
  // branches control flow on a specific customer's identity, only on a
  // flag's value.
  features: z.record(z.boolean()).default({}),
});
export type Settings = z.infer<typeof settingsSchema>;

export const EMPTY_SETTINGS: Settings = { terminology: {}, features: {} };

// Location settings override organization settings key by key. This is a
// small, explicit merge — not a general configuration-resolution engine.
export function mergeSettings(organizationSettings: Settings, locationSettings: Settings): Settings {
  return {
    terminology: { ...organizationSettings.terminology, ...locationSettings.terminology },
    features: { ...organizationSettings.features, ...locationSettings.features },
  };
}
