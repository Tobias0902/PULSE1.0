// See customers/customers.capability.ts's doc comment — same pattern,
// for Location instead of Customer.
export const LOCATIONS_FIND_ONE = Symbol("LOCATIONS_FIND_ONE");

export interface LocationsFindOneCapability {
  findOne(id: string, organizationId: string): Promise<unknown>;
}
