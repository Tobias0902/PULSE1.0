import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { modules, organizationModules } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { EventBusService } from "../events/event-bus.service";

// Postgres schema/table identifiers can't be bind-parameterized in DDL.
// This repo's own descriptors are compile-time and already constrained by
// validateDescriptors(), but this service issues DROP statements, so this
// extra runtime check is cheap defense-in-depth specifically for that.
const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]*$/;

// Distinct, explicitly-audited administrative action, separate from
// ModuleActivationService's activate/deactivate (CLAUDE.md Decision #7
// §11 — "a module can be disabled without deleting its data... actual
// data removal requires a separate, explicit, audited administrative
// action"). This one is destructive and irreversible: it drops the
// module's own Postgres schema and migration-tracking table. It never
// touches Core's or another module's schema — the only schema name it
// ever acts on is the one recorded on this module's own `modules` row,
// and DROP SCHEMA ... CASCADE only reaches objects inside that one named
// schema.
//
// No REST endpoint wires this up yet — this is the service-level
// capability MODULE_SDK_DESIGN.md §2 asked for; exposing it via an
// administrative route is a separate, later decision.
@Injectable()
export class ModuleUninstallService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  // `confirmModuleId` is the second explicit confirmation the design
  // calls for: the caller must pass the module id twice (once as the
  // target, once to confirm) so a single mistaken/malformed call can't
  // trigger it.
  async uninstall(moduleId: string, confirmModuleId: string, actorUserId: string): Promise<void> {
    if (confirmModuleId !== moduleId) {
      throw new BadRequestException("Confirmation id does not match the module id to uninstall.");
    }

    const module = await this.db.query.modules.findFirst({ where: eq(modules.id, moduleId) });
    if (!module) throw new NotFoundException("Module not found.");

    if (module.isCore) {
      throw new BadRequestException("PULSE-Core cannot be uninstalled.");
    }

    const stillActive = await this.db.query.organizationModules.findMany({
      where: and(eq(organizationModules.moduleId, moduleId), eq(organizationModules.isActive, true)),
    });
    if (stillActive.length > 0) {
      throw new BadRequestException(
        `Cannot uninstall "${moduleId}": it is still active for ${stillActive.length} organization(s). ` +
          `Deactivate it for every organization first.`,
      );
    }

    if (module.postgresSchema && !SAFE_IDENTIFIER.test(module.postgresSchema)) {
      throw new BadRequestException(
        `Module "${moduleId}" has an unsafe postgresSchema value; refusing to uninstall.`,
      );
    }

    await this.db.transaction(async (tx) => {
      // organization_modules.module_id references modules.id — dependent
      // rows must go first or the module row's delete would fail the FK
      // constraint.
      await tx.delete(organizationModules).where(eq(organizationModules.moduleId, moduleId));
      await tx.delete(modules).where(eq(modules.id, moduleId));

      if (module.postgresSchema) {
        await tx.execute(sql`DROP SCHEMA IF EXISTS ${sql.identifier(module.postgresSchema)} CASCADE`);
        // The migration-tracking table lives in the default ("public")
        // schema, not inside the module's own schema — migrate.ts only
        // passes `migrationsTable`, never `migrationsSchema` — so it needs
        // its own explicit drop, schema-qualified rather than relying on
        // search_path.
        await tx.execute(
          sql`DROP TABLE IF EXISTS "public".${sql.identifier(`__drizzle_migrations_${moduleId}`)}`,
        );
      }

      await this.auditService.recordMutation(
        {
          organizationId: null,
          userId: actorUserId,
          entityType: "Module",
          entityId: moduleId,
          action: "delete",
          payload: { moduleId, postgresSchema: module.postgresSchema },
        },
        tx,
      );
      await this.eventBus.publish(tx, {
        organizationId: null,
        eventType: "module.uninstalled",
        entityType: "Module",
        entityId: moduleId,
        payload: { moduleId },
      });
    });
  }
}
