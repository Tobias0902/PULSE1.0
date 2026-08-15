// The narrow surface another module may depend on instead of the full
// CustomersService class — CLAUDE.md Decision #7 §7's "explicitly
// exported interfaces" made real for the one capability Calendar actually
// consumes (MODULE_SDK_DESIGN.md §5/§6). The return type is deliberately
// opaque: a consumer only needs "did this resolve or throw", not
// Customer's full row shape, which stays Core-internal.
export const CUSTOMERS_FIND_ONE = Symbol("CUSTOMERS_FIND_ONE");

export interface CustomersFindOneCapability {
  findOne(id: string, organizationId: string): Promise<unknown>;
}
