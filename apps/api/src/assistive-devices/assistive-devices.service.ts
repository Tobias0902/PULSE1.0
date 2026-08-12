import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { CreateAssistiveDeviceInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { assistiveDevices, customers } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { single } from "../common/single";

@Injectable()
export class AssistiveDevicesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateAssistiveDeviceInput, actorUserId: string, organizationId: string) {
    const customer = await this.db.query.customers.findFirst({
      where: and(eq(customers.id, input.customerId), eq(customers.organizationId, organizationId)),
    });
    if (!customer) throw new NotFoundException("Customer not found.");

    const device = single(
      await this.db
        .insert(assistiveDevices)
        .values({ ...input, organizationId, createdBy: actorUserId, updatedBy: actorUserId })
        .returning(),
    );
    await this.auditService.recordMutation({
      organizationId,
      userId: actorUserId,
      entityType: "AssistiveDevice",
      entityId: device.id,
      action: "create",
      payload: input,
    });
    return device;
  }

  findByCustomer(customerId: string, organizationId: string) {
    return this.db.query.assistiveDevices.findMany({
      where: and(eq(assistiveDevices.customerId, customerId), eq(assistiveDevices.organizationId, organizationId)),
    });
  }

  async findOne(id: string, organizationId: string) {
    const device = await this.db.query.assistiveDevices.findFirst({
      where: and(eq(assistiveDevices.id, id), eq(assistiveDevices.organizationId, organizationId)),
    });
    if (!device) throw new NotFoundException("AssistiveDevice not found.");
    return device;
  }
}
