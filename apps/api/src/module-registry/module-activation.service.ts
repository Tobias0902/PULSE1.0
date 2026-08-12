import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { modules, organizationModules } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { assertVersionedUpdateApplied } from "../common/optimistic-lock";

@Injectable()
export class ModuleActivationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async isActiveForOrg(organizationId: string, moduleId: string): Promise<boolean> {
    const row = await this.db.query.organizationModules.findFirst({
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
  async setActivation(
    organizationId: string,
    moduleId: string,
    isActive: boolean,
    expectedVersion: number,
    actorUserId: string,
  ) {
    const module = await this.db.query.modules.findFirst({ where: eq(modules.id, moduleId) });
    if (!module) throw new NotFoundException("Module not found.");

    if (isActive) {
      for (const dependencyId of module.dependsOn) {
        if (!(await this.isActiveForOrg(organizationId, dependencyId))) {
          throw new BadRequestException(
            `Cannot activate "${moduleId}": its dependency "${dependencyId}" is not active for this organization.`,
          );
        }
      }
    } else {
      const dependents = await this.findActiveDependents(organizationId, moduleId);
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

    const [row] = await this.db
      .insert(organizationModules)
      .values({ organizationId, moduleId, isActive, version: 1, ...activationFields })
      .onConflictDoUpdate({
        target: [organizationModules.organizationId, organizationModules.moduleId],
        set: { isActive, updatedAt: now, version: sql`${organizationModules.version} + 1`, ...activationFields },
        where: eq(organizationModules.version, expectedVersion),
      })
      .returning();

    const result = assertVersionedUpdateApplied(row, "OrganizationModule");
    await this.auditService.recordMutation({
      organizationId,
      userId: actorUserId,
      entityType: "OrganizationModule",
      entityId: moduleId,
      action: isActive ? "create" : "update",
      payload: { moduleId, isActive },
    });
    return result;
  }

  // Deactivating a module must never leave another active module pointing
  // at a dependency that's no longer active for this organization.
  private async findActiveDependents(organizationId: string, moduleId: string): Promise<string[]> {
    const activeRows = await this.db.query.organizationModules.findMany({
      where: and(eq(organizationModules.organizationId, organizationId), eq(organizationModules.isActive, true)),
    });
    if (activeRows.length === 0) return [];

    const activeModules = await this.db.query.modules.findMany({
      where: inArray(
        modules.id,
        activeRows.map((row) => row.moduleId),
      ),
    });
    return activeModules.filter((m) => m.dependsOn.includes(moduleId)).map((m) => m.id);
  }
}
