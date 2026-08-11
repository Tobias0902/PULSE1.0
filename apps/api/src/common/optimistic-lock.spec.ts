import { ConflictException } from "@nestjs/common";
import { assertVersionedUpdateApplied } from "./optimistic-lock";

describe("assertVersionedUpdateApplied", () => {
  it("returns the row when the versioned update matched", () => {
    const row = { id: "1", version: 2 };
    expect(assertVersionedUpdateApplied(row, "Case")).toBe(row);
  });

  it("throws a ConflictException when no row matched a stale version", () => {
    expect(() => assertVersionedUpdateApplied(undefined, "Case")).toThrow(ConflictException);
  });
});
