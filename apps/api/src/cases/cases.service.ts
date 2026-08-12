import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { CreateCaseInput, UpdateCaseInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { assistiveDevices, cases } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { EventBusService } from "../events/event-bus.service";
import { assertVersionedUpdateApplied } from "../common/optimistic-lock";
import { single } from "../common/single";

@Injectable()
export class CasesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  // create/update are representative proof-of-pattern flows for the
  // transactional outbox (CLAUDE.md's event-foundation design): the entity
  // write, the audit record, and the published event share one
  // transaction, so a crash between any of them rolls all three back
  // together instead of silently losing the audit trail or the event.
  // Other services are not backfilled to this pattern yet — see the
  // foundation-iteration plan for why.
  async create(input: CreateCaseInput, actorUserId: string, organizationId: string) {
    return this.db.transaction(async (tx) => {
      const device = await tx.query.assistiveDevices.findFirst({
        where: and(eq(assistiveDevices.id, input.assistiveDeviceId), eq(assistiveDevices.organizationId, organizationId)),
      });
      if (!device) throw new NotFoundException("AssistiveDevice not found.");

      const caseRecord = single(
        await tx
          .insert(cases)
          .values({ ...input, organizationId, createdBy: actorUserId, updatedBy: actorUserId })
          .returning(),
      );
      await this.auditService.recordMutation(
        {
          organizationId,
          userId: actorUserId,
          entityType: "Case",
          entityId: caseRecord.id,
          action: "create",
          payload: input,
        },
        tx,
      );
      await this.eventBus.publish(tx, {
        organizationId,
        eventType: "case.created",
        entityType: "Case",
        entityId: caseRecord.id,
        payload: caseRecord,
      });
      return caseRecord;
    });
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
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(cases)
        .set({ ...changes, updatedBy: actorUserId, updatedAt: new Date(), version: sql`${cases.version} + 1` })
        .where(and(eq(cases.id, id), eq(cases.version, version), eq(cases.organizationId, organizationId)))
        .returning();
      const caseRecord = assertVersionedUpdateApplied(updated, "Case");
      await this.auditService.recordMutation(
        {
          organizationId,
          userId: actorUserId,
          entityType: "Case",
          entityId: caseRecord.id,
          action: "update",
          payload: changes,
        },
        tx,
      );
      await this.eventBus.publish(tx, {
        organizationId,
        eventType: "case.updated",
        entityType: "Case",
        entityId: caseRecord.id,
        payload: changes,
      });
      return caseRecord;
    });
  }
}
