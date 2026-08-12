import { fromLocationColumns, toLocationColumns } from "./calendar-event-location";

describe("toLocationColumns / fromLocationColumns", () => {
  it("round-trips a customerAddress location, storing only the reference", () => {
    const location = { type: "customerAddress" as const, customerId: "11111111-1111-1111-1111-111111111111" };
    const columns = toLocationColumns(location);
    expect(columns).toEqual({
      locationType: "customerAddress",
      locationCustomerId: location.customerId,
      locationCoreLocationId: null,
      locationName: null,
      locationAddress: null,
    });
    expect(fromLocationColumns(columns)).toEqual(location);
  });

  it("round-trips a coreLocation location, storing only the reference", () => {
    const location = { type: "coreLocation" as const, locationId: "22222222-2222-2222-2222-222222222222" };
    const columns = toLocationColumns(location);
    expect(columns.locationCoreLocationId).toBe(location.locationId);
    expect(columns.locationCustomerId).toBeNull();
    expect(fromLocationColumns(columns)).toEqual(location);
  });

  it("round-trips an external location, storing its own name and address directly", () => {
    const location = { type: "external" as const, name: "City General Hospital", address: "12 Main St" };
    const columns = toLocationColumns(location);
    expect(columns).toEqual({
      locationType: "external",
      locationCustomerId: null,
      locationCoreLocationId: null,
      locationName: "City General Hospital",
      locationAddress: "12 Main St",
    });
    expect(fromLocationColumns(columns)).toEqual(location);
  });

  it("round-trips a remote location with no reference at all", () => {
    const columns = toLocationColumns({ type: "remote" });
    expect(columns).toEqual({
      locationType: "remote",
      locationCustomerId: null,
      locationCoreLocationId: null,
      locationName: null,
      locationAddress: null,
    });
    expect(fromLocationColumns(columns)).toEqual({ type: "remote" });
  });
});
