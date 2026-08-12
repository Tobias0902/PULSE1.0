import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DATABASE_CONNECTION, Database, DbClient } from "../database/database.provider";
import { modules, organizationModules } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { EventBusService } from "../events/event-bus.service";
import { assertVersionedUpdateApplied } from "../common/optimistic-lock";

@Injectable()
export class ModuleActivationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async isActiveForOrg(organizationId: string, moduleId: string, db: DbClient = this.db): Promise<boolean> {
    const row = await db.query.organizationModules.findFirst({
      where: and(eq(organizationModules.organizationId, organizationId), eq(organizationModules.moduleId, moduleId)),
    });
    return row?.isActive ?? false;
  }

  listForOrganization(organizationId: string) {
    return this.db.query.organizationModules.findMany({
      where: eq(organizationModules.organizationId, organizationId),
    });
  }

  // A module that has never been touched for this organization has no row
  // yet. By convention, callers pass version 0 for a first-ever activation;
  // the INSERT branch below always succeeds in that case regardless of
  // `expectedVersion` (Postgres only evaluates the WHERE guard on an actual
  // conflict), and a genuine race against a real first activation still
  // correctly hits the conflict branch and is rejected.
  //
  // The dependency checks, the write, the audit record, and the published
  // event all share one transaction — same proof-of-pattern reasoning as
  // CasesService.create/update for the transactional-outbox design.
  async setActivation(
    organizationId: string,
    moduleId: string,
    isActive: boolean,
    expectedVersion: number,
    actorUserId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const module = await tx.query.modules.findFirst({ where: eq(modules.id, moduleId) });
      if (!module) throw new NotFoundException("Module not found.");

      if (isActive) {
        for (const dependencyId of module.dependsOn) {
          if (!(await this.isActiveForOrg(organizationId, dependencyId, tx))) {
            throw new BadRequestException(
              `Cannot activate "${moduleId}": its dependency "${dependencyId}" is not active for this organization.`,
            );
          }
        }
      } else {
        const dependents = await this.findActiveDependents(organizationId, moduleId, tx);
        if (dependents.length > 0) {
          throw new BadRequestException(
            `Cannot deactivate "${moduleId}": it is required by active module(s): ${dependents.join(", ")}.`,
          );
        }
      }

      const now = new Date();
      const activationFields = isActive
        ? { activatedAt: now, activatedBy: actorUserId }
        : { deactivatedAt: now, deactivatedBy: actorUserId };

      const [row] = await tx
        .insert(organizationModules)
        .values({ organizationId, moduleId, isActive, version: 1, ...activationFields })
        .onConflictDoUpdate({
          target: [organizationModules.organizationId, organizationModules.moduleId],
          set: { isActive, updatedAt: now, version: sql`${organizationModules.version} + 1`, ...activationFields },
          where: eq(organizationModules.version, expectedVersion),
        })
        .returning();

      const result = assertVersionedUpdateApplied(row, "OrganizationModule");
      await this.auditService.recordMutation(
        {
          organizationId,
          userId: actorUserId,
          entityType: "OrganizationModule",
          entityId: moduleId,
          action: isActive ? "create" : "update",
          payload: { moduleId, isActive },
        },
        tx,
      );
      await this.eventBus.publish(tx, {
        organizationId,
        eventType: isActive ? "module.activated" : "module.deactivated",
        entityType: "OrganizationModule",
        entityId: moduleId,
        payload: { moduleId, isActive },
      });
      return result;
    });
  }

  // Deactivating a module must never leave another active module pointing
  // at a dependency that's no longer active for this organization.
  private async findActiveDependents(
    organizationId: string,
    moduleId: string,
    db: DbClient = this.db,
  ): Promise<string[]> {
    const activeRows = await db.query.organizationModules.findMany({
      where: and(eq(organizationModules.organizationId, organizationId), eq(organizationModules.isActive, true)),
    });
    if (activeRows.length === 0) return [];

    const activeModules = await db.query.modules.findMany({
      where: inArray(
        modules.id,
        activeRows.map((row) => row.moduleId),
      ),
    });
    return activeModules.filter((m) => m.dependsOn.includes(moduleId)).map((m) => m.id);
  }
}
