// Placeholder permission-key catalog for this foundation iteration only.
// NOT the final Decision #4 permission catalog design (open decision).
export const PERMISSION_KEYS = [
  "organization:read",
  "organization:write",
  "location:read",
  "location:write",
  "user:read",
  "user:write",
  "role:read",
  "role:write",
  "customer:read",
  "customer:write",
  "assistiveDevice:read",
  "assistiveDevice:write",
  "case:read",
  "case:write",
  "appointment:read",
  "appointment:write",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
