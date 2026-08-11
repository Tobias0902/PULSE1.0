import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { CreateCaseInput, UpdateCaseInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { assistiveDevices, cases, customers } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { assertVersionedUpdateApplied } from "../common/optimistic-lock";
import { single } from "../common/single";

@Injectable()
export class CasesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateCaseInput, actorUserId: string) {
    const organizationId = await this.resolveOrganizationId(input.assistiveDeviceId);

    const caseRecord = single(
      await this.db
        .insert(cases)
        .values({ ...input, createdBy: actorUserId, updatedBy: actorUserId })
        .returning(),
    );
    await this.auditService.recordMutation({
      organizationId,
      userId: actorUserId,
      entityType: "Case",
      entityId: caseRecord.id,
      action: "create",
      payload: input,
    });
    return caseRecord;
  }

  findByAssistiveDevice(assistiveDeviceId: string) {
    return this.db.query.cases.findMany({ where: eq(cases.assistiveDeviceId, assistiveDeviceId) });
  }

  async findOne(id: string) {
    const caseRecord = await this.db.query.cases.findFirst({ where: eq(cases.id, id) });
    if (!caseRecord) throw new NotFoundException("Case not found.");
    return caseRecord;
  }

  async update(id: string, input: UpdateCaseInput, actorUserId: string) {
    const { version, ...changes } = input;
    const [updated] = await this.db
      .update(cases)
      .set({ ...changes, updatedBy: actorUserId, updatedAt: new Date(), version: sql`${cases.version} + 1` })
      .where(and(eq(cases.id, id), eq(cases.version, version)))
      .returning();
    const caseRecord = assertVersionedUpdateApplied(updated, "Case");
    const organizationId = await this.resolveOrganizationId(caseRecord.assistiveDeviceId);
    await this.auditService.recordMutation({
      organizationId,
      userId: actorUserId,
      entityType: "Case",
      entityId: caseRecord.id,
      action: "update",
      payload: changes,
    });
    return caseRecord;
  }

  private async resolveOrganizationId(assistiveDeviceId: string): Promise<string | null> {
    const device = await this.db.query.assistiveDevices.findFirst({
      where: eq(assistiveDevices.id, assistiveDeviceId),
    });
    if (!device) throw new NotFoundException("AssistiveDevice not found.");
    const customer = await this.db.query.customers.findFirst({ where: eq(customers.id, device.customerId) });
    return customer?.organizationId ?? null;
  }
}
