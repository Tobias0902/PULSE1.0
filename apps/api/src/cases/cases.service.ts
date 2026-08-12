import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { CreateCaseInput, UpdateCaseInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { assistiveDevices, cases } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { assertVersionedUpdateApplied } from "../common/optimistic-lock";
import { single } from "../common/single";

@Injectable()
export class CasesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateCaseInput, actorUserId: string, organizationId: string) {
    const device = await this.db.query.assistiveDevices.findFirst({
      where: and(eq(assistiveDevices.id, input.assistiveDeviceId), eq(assistiveDevices.organizationId, organizationId)),
    });
    if (!device) throw new NotFoundException("AssistiveDevice not found.");

    const caseRecord = single(
      await this.db
        .insert(cases)
        .values({ ...input, organizationId, createdBy: actorUserId, updatedBy: actorUserId })
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

  findByAssistiveDevice(assistiveDeviceId: string, organizationId: string) {
    return this.db.query.cases.findMany({
      where: and(eq(cases.assistiveDeviceId, assistiveDeviceId), eq(cases.organizationId, organizationId)),
    });
  }

  async findOne(id: string, organizationId: string) {
    const caseRecord = await this.db.query.cases.findFirst({
      where: and(eq(cases.id, id), eq(cases.organizationId, organizationId)),
    });
    if (!caseRecord) throw new NotFoundException("Case not found.");
    return caseRecord;
  }

  async update(id: string, input: UpdateCaseInput, actorUserId: string, organizationId: string) {
    const { version, ...changes } = input;
    const [updated] = await this.db
      .update(cases)
      .set({ ...changes, updatedBy: actorUserId, updatedAt: new Date(), version: sql`${cases.version} + 1` })
      .where(and(eq(cases.id, id), eq(cases.version, version), eq(cases.organizationId, organizationId)))
      .returning();
    const caseRecord = assertVersionedUpdateApplied(updated, "Case");
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
}
