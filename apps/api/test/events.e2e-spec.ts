import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SchedulerRegistry } from "@nestjs/schedule";
import request from "supertest";
import * as argon2 from "argon2";
import { and, eq, inArray } from "drizzle-orm";
import { PERMISSION_KEYS } from "@pulse/domain";
import { AppModule } from "../src/app.module";
import { DATABASE_CONNECTION, Database } from "../src/database/database.provider";
import { single } from "../src/common/single";
import { EventBusService } from "../src/events/event-bus.service";
import { EVENT_DISPATCH_INTERVAL_NAME, EventDispatcherService } from "../src/events/event-dispatcher.service";
import {
  assistiveDevices,
  auditEvents,
  cases,
  customers,
  domainEvents,
  modules,
  organizationModules,
  organizations,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "../src/database/schema";

// Proves the transactional-outbox event foundation: rollback safety,
// at-least-once dispatch with retry-on-failure, safe concurrent dispatch
// (FOR UPDATE SKIP LOCKED), and real wiring into Case creation and module
// activation. The background @Interval is stopped in favor of driving
// dispatchBatch() directly, so these tests are deterministic rather than
// racing a real 1s timer.
describe("Event foundation (e2e)", () => {
  let app: INestApplication;
  let db: Database;
  let eventBus: EventBusService;
  let dispatcher: EventDispatcherService;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];
  const testModuleId = "test-events-module";

  let orgA: { id: string; token: string };

  async function makeOrgWithAdmin(name: string, email: string) {
    const org = single(await db.insert(organizations).values({ name }).returning());
    createdOrgIds.push(org.id);

    const existing = await db.query.permissions.findMany();
    const byKey = new Map(existing.map((p) => [p.key, p]));
    const missing = PERMISSION_KEYS.filter((key) => !byKey.has(key));
    if (missing.length > 0) {
      const inserted = await db
        .insert(permissions)
        .values(missing.map((key) => ({ key, description: `e2e test permission: ${key}` })))
        .returning();
      inserted.forEach((p) => byKey.set(p.key, p));
    }

    const role = single(await db.insert(roles).values({ organizationId: org.id, name: "E2E Admin" }).returning());
    createdRoleIds.push(role.id);
    await db
      .insert(rolePermissions)
      .values(PERMISSION_KEYS.map((key) => ({ roleId: role.id, permissionId: byKey.get(key)!.id })));

    const passwordHash = await argon2.hash("e2e-test-password-123456", { type: argon2.argon2id });
    const user = single(
      await db.insert(users).values({ organizationId: org.id, email, passwordHash, displayName: "E2E Admin" }).returning(),
    );
    createdUserIds.push(user.id);
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id });

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "e2e-test-password-123456" })
      .expect(200);
    return { id: org.id, token: loginResponse.body.accessToken as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1", { exclude: ["api/docs", "api/docs-json"] });
    await app.init();
    db = app.get(DATABASE_CONNECTION);
    eventBus = app.get(EventBusService);
    dispatcher = app.get(EventDispatcherService);
    app.get(SchedulerRegistry).deleteInterval(EVENT_DISPATCH_INTERVAL_NAME);

    orgA = await makeOrgWithAdmin("E2E Events Org", `e2e-events-${Date.now()}@pulse.test`);
    await db
      .insert(modules)
      .values({ id: testModuleId, name: "Test Events Module", version: "0.0.1", sdkVersion: "1", dependsOn: [] })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(domainEvents).where(inArray(domainEvents.organizationId, createdOrgIds));
    await db.delete(organizationModules).where(inArray(organizationModules.organizationId, createdOrgIds));
    await db.delete(cases).where(inArray(cases.organizationId, createdOrgIds));
    await db.delete(assistiveDevices).where(inArray(assistiveDevices.organizationId, createdOrgIds));
    await db.delete(customers).where(inArray(customers.organizationId, createdOrgIds));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, createdOrgIds));
    await db.delete(refreshTokens).where(inArray(refreshTokens.userId, createdUserIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, createdRoleIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    await db.delete(roles).where(inArray(roles.id, createdRoleIds));
    await db.delete(modules).where(eq(modules.id, testModuleId));
    await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
    await app.close();
  });

  it("never persists an event published inside a transaction that rolls back", async () => {
    const eventType = "test.outbox-rollback";
    await expect(
      db.transaction(async (tx) => {
        await eventBus.publish(tx, { organizationId: orgA.id, eventType, payload: { x: 1 } });
        throw new Error("forced rollback");
      }),
    ).rejects.toThrow("forced rollback");

    const rows = await db.query.domainEvents.findMany({ where: eq(domainEvents.eventType, eventType) });
    expect(rows).toHaveLength(0);
  });

  it("dispatches an unprocessed event to its subscriber and marks it processed", async () => {
    const eventType = "test.dispatch-success";
    const received: unknown[] = [];
    eventBus.subscribe(eventType, (event) => {
      received.push(event.payload);
    });
    await db.transaction((tx) => eventBus.publish(tx, { organizationId: orgA.id, eventType, payload: { hello: "world" } }));

    await dispatcher.dispatchBatch();

    expect(received).toEqual([{ hello: "world" }]);
    const row = single(await db.query.domainEvents.findMany({ where: eq(domainEvents.eventType, eventType) }));
    expect(row.processedAt).not.toBeNull();
    await db.delete(domainEvents).where(eq(domainEvents.eventType, eventType));
  });

  it("retries a failing subscriber without losing the event, and records the error", async () => {
    const eventType = "test.dispatch-failure";
    eventBus.subscribe(eventType, () => {
      throw new Error("handler exploded");
    });
    await db.transaction((tx) => eventBus.publish(tx, { organizationId: orgA.id, eventType, payload: {} }));

    await dispatcher.dispatchBatch();

    const row = single(await db.query.domainEvents.findMany({ where: eq(domainEvents.eventType, eventType) }));
    expect(row.processedAt).toBeNull();
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain("handler exploded");
    await db.delete(domainEvents).where(eq(domainEvents.eventType, eventType));
  });

  it("never double-processes the same row under concurrent dispatch batches", async () => {
    const eventType = "test.dispatch-concurrent";
    let invocations = 0;
    eventBus.subscribe(eventType, async () => {
      invocations += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await db.transaction((tx) => eventBus.publish(tx, { organizationId: orgA.id, eventType, payload: {} }));

    await Promise.all([dispatcher.dispatchBatch(), dispatcher.dispatchBatch()]);

    expect(invocations).toBe(1);
    await db.delete(domainEvents).where(eq(domainEvents.eventType, eventType));
  });

  it("publishes case.created when a case is created through the real API", async () => {
    const customer = single(
      await db.insert(customers).values({ organizationId: orgA.id, name: "Event Test Customer" }).returning(),
    );
    const device = single(
      await db
        .insert(assistiveDevices)
        .values({ organizationId: orgA.id, customerId: customer.id, label: "Event Test Device" })
        .returning(),
    );

    const caseRes = await request(app.getHttpServer())
      .post("/api/v1/cases")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ assistiveDeviceId: device.id, title: "Event Test Case" })
      .expect(201);

    const eventRow = single(
      await db.query.domainEvents.findMany({
        where: and(eq(domainEvents.eventType, "case.created"), eq(domainEvents.entityId, caseRes.body.id)),
      }),
    );
    expect(eventRow.organizationId).toBe(orgA.id);
    expect(eventRow.entityType).toBe("Case");

    await db.delete(domainEvents).where(eq(domainEvents.entityId, caseRes.body.id));
    await db.delete(cases).where(eq(cases.id, caseRes.body.id));
    await db.delete(assistiveDevices).where(eq(assistiveDevices.id, device.id));
    await db.delete(customers).where(eq(customers.id, customer.id));
  });

  it("publishes module.activated when a module is activated through the real API", async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/modules/${testModuleId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ isActive: true, version: 0 })
      .expect(200);

    const eventRow = single(
      await db.query.domainEvents.findMany({
        where: and(eq(domainEvents.eventType, "module.activated"), eq(domainEvents.entityId, testModuleId)),
      }),
    );
    expect(eventRow.organizationId).toBe(orgA.id);
  });
});
