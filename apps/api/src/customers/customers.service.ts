import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { CreateCustomerInput, UpdateCustomerInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { customers } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { assertVersionedUpdateApplied } from "../common/optimistic-lock";
import { single } from "../common/single";

@Injectable()
export class CustomersService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateCustomerInput, actorUserId: string) {
    const customer = single(
      await this.db
        .insert(customers)
        .values({ ...input, createdBy: actorUserId, updatedBy: actorUserId })
        .returning(),
    );
    await this.auditService.recordMutation({
      organizationId: customer.organizationId,
      userId: actorUserId,
      entityType: "Customer",
      entityId: customer.id,
      action: "create",
      payload: input,
    });
    return customer;
  }

  findByOrganization(organizationId: string) {
    return this.db.query.customers.findMany({ where: eq(customers.organizationId, organizationId) });
  }

  async findOne(id: string) {
    const customer = await this.db.query.customers.findFirst({ where: eq(customers.id, id) });
    if (!customer) throw new NotFoundException("Customer not found.");
    return customer;
  }

  async update(id: string, input: UpdateCustomerInput, actorUserId: string) {
    const { version, ...changes } = input;
    const [updated] = await this.db
      .update(customers)
      .set({ ...changes, updatedBy: actorUserId, updatedAt: new Date(), version: sql`${customers.version} + 1` })
      .where(and(eq(customers.id, id), eq(customers.version, version)))
      .returning();
    const customer = assertVersionedUpdateApplied(updated, "Customer");
    await this.auditService.recordMutation({
      organizationId: customer.organizationId,
      userId: actorUserId,
      entityType: "Customer",
      entityId: customer.id,
      action: "update",
      payload: changes,
    });
    return customer;
  }
}
