// Drizzle's `.returning()` types every row as possibly absent (TS strict
// mode has no way to know a successful INSERT ... RETURNING always yields
// exactly one row per inserted row). This asserts that internal guarantee
// instead of adding a defensive branch that can never actually run.
export function single<T>(rows: T[]): T {
  const [row] = rows;
  if (!row) {
    throw new Error("Expected exactly one row from a RETURNING clause but got none.");
  }
  return row;
}
