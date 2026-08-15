import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ModuleUninstallService } from "./module-uninstall.service";
import { AuditService } from "../common/audit/audit.service";
import { EventBusService } from "../events/event-bus.service";
import { Database } from "../database/database.provider";

// A minimal fake covering only what ModuleUninstallService actually calls.
// Deliberately never touches a real database — this proves the guard
// logic and the shape of the destructive statements issued, without
// executing any DROP against a live Postgres instance.
function makeDb(moduleRow: unknown, activeOrgRows: unknown[]) {
  const deleteWhere = jest.fn().mockResolvedValue(undefined);
  const deleteFn = jest.fn(() => ({ where: deleteWhere }));
  const executeFn = jest.fn().mockResolvedValue(undefined);

  const tx = {
    delete: deleteFn,
    execute: executeFn,
  };

  const db = {
    query: {
      modules: { findFirst: jest.fn().mockResolvedValue(moduleRow) },
      organizationModules: { findMany: jest.fn().mockResolvedValue(activeOrgRows) },
    },
    transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) => callback(tx)),
  };

  return { db: db as unknown as Database, tx, deleteFn, deleteWhere, executeFn };
}

function makeAuditService() {
  return { recordMutation: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
}

function makeEventBus() {
  return { publish: jest.fn().mockResolvedValue(undefined) } as unknown as EventBusService;
}

const calendarModuleRow = {
  id: "calendar",
  name: "PULSE Calendar",
  isCore: false,
  postgresSchema: "calendar",
};

describe("ModuleUninstallService", () => {
  it("rejects when the confirmation id does not match the target module id", async () => {
    const { db } = makeDb(calendarModuleRow, []);
    const service = new ModuleUninstallService(db, makeAuditService(), makeEventBus());

    await expect(service.uninstall("calendar", "not-calendar", "user-1")).rejects.toThrow(BadRequestException);
  });

  it("rejects when the module does not exist", async () => {
    const { db } = makeDb(undefined, []);
    const service = new ModuleUninstallService(db, makeAuditService(), makeEventBus());

    await expect(service.uninstall("ghost", "ghost", "user-1")).rejects.toThrow(NotFoundException);
  });

  it("rejects uninstalling Core", async () => {
    const { db } = makeDb({ id: "core", isCore: true, postgresSchema: "core" }, []);
    const service = new ModuleUninstallService(db, makeAuditService(), makeEventBus());

    await expect(service.uninstall("core", "core", "user-1")).rejects.toThrow(/cannot be uninstalled/);
  });

  it("rejects when the module is still active for at least one organization", async () => {
    const { db } = makeDb(calendarModuleRow, [{ organizationId: "org-1", isActive: true }]);
    const service = new ModuleUninstallService(db, makeAuditService(), makeEventBus());

    await expect(service.uninstall("calendar", "calendar", "user-1")).rejects.toThrow(/still active/);
  });

  it("drops the module's schema and tracking table, deletes its rows, and audits/publishes, when every guard passes", async () => {
    const { db, deleteFn, executeFn } = makeDb(calendarModuleRow, []);
    const auditService = makeAuditService();
    const eventBus = makeEventBus();
    const service = new ModuleUninstallService(db, auditService, eventBus);

    await service.uninstall("calendar", "calendar", "user-1");

    // Dependent organization_modules rows deleted before the modules row
    // itself, since the former has a foreign key into the latter.
    expect(deleteFn).toHaveBeenCalledTimes(2);

    // Exactly two DDL statements: the module's own schema, and its
    // migration-tracking table — nothing else.
    expect(executeFn).toHaveBeenCalledTimes(2);

    expect(auditService.recordMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "Module", entityId: "calendar", action: "delete" }),
      expect.anything(),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "module.uninstalled", entityId: "calendar" }),
    );
  });

  it("refuses to run DROP statements against an unsafe postgresSchema value", async () => {
    const { db, executeFn } = makeDb({ id: "calendar", isCore: false, postgresSchema: "calendar; DROP SCHEMA core" }, []);
    const service = new ModuleUninstallService(db, makeAuditService(), makeEventBus());

    await expect(service.uninstall("calendar", "calendar", "user-1")).rejects.toThrow(/unsafe postgresSchema/);
    expect(executeFn).not.toHaveBeenCalled();
  });
});
