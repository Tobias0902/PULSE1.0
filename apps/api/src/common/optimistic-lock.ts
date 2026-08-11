import { ConflictException } from "@nestjs/common";

// Entity/version-based optimistic concurrency (CLAUDE.md Decision #6): the
// caller's update carries the version it was based on; if no row matches
// both the id and that version, the server state has moved on, and we
// reject rather than silently overwrite newer data.
export function assertVersionedUpdateApplied<T>(row: T | undefined, entityName: string): T {
  if (!row) {
    throw new ConflictException(
      `${entityName} was modified by someone else since you last loaded it. Reload and try again.`,
    );
  }
  return row;
}
