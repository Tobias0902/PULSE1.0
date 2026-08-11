export interface JwtPayload {
  sub: string; // user id
  organizationId: string;
  // Permissions resolved at token-issuance time. Bounded staleness window
  // (the access-token TTL) is an accepted trade-off against a DB lookup on
  // every guarded request; a role/permission change takes effect on the
  // user's next login or token refresh.
  permissions: string[];
}
