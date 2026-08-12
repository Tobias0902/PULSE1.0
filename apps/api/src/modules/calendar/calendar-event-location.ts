import { CalendarEventLocation } from "@pulse/domain";

// The four location kinds map onto a flat set of nullable columns (see
// calendar.schema.ts) rather than a jsonb blob, so a future query like
// "events referencing customer X" stays a plain indexable column lookup.
// These two pure functions are the only place that mapping happens.
export interface CalendarEventLocationColumns {
  locationType: string;
  locationCustomerId: string | null;
  locationCoreLocationId: string | null;
  locationName: string | null;
  locationAddress: string | null;
}

export function toLocationColumns(location: CalendarEventLocation): CalendarEventLocationColumns {
  switch (location.type) {
    case "customerAddress":
      return {
        locationType: "customerAddress",
        locationCustomerId: location.customerId,
        locationCoreLocationId: null,
        locationName: null,
        locationAddress: null,
      };
    case "coreLocation":
      return {
        locationType: "coreLocation",
        locationCustomerId: null,
        locationCoreLocationId: location.locationId,
        locationName: null,
        locationAddress: null,
      };
    case "external":
      return {
        locationType: "external",
        locationCustomerId: null,
        locationCoreLocationId: null,
        locationName: location.name,
        locationAddress: location.address,
      };
    case "remote":
      return {
        locationType: "remote",
        locationCustomerId: null,
        locationCoreLocationId: null,
        locationName: null,
        locationAddress: null,
      };
  }
}

export function fromLocationColumns(row: CalendarEventLocationColumns): CalendarEventLocation {
  switch (row.locationType) {
    case "customerAddress":
      return { type: "customerAddress", customerId: row.locationCustomerId! };
    case "coreLocation":
      return { type: "coreLocation", locationId: row.locationCoreLocationId! };
    case "external":
      return { type: "external", name: row.locationName, address: row.locationAddress };
    default:
      return { type: "remote" };
  }
}
