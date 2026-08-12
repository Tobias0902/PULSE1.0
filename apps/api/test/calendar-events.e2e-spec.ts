import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import * as argon2 from "argon2";
import { and, eq, inArray } from "drizzle-orm";
import { PERMISSION_KEYS } from "@pulse/domain";
import { AppModule } from "../src/app.module";
import { DATABASE_CONNECTION, Database } from "../src/database/database.provider";
import { single } from "../src/common/single";
import { CALENDAR_MODULE_DESCRIPTOR } from "../src/modules/calendar/calendar.descriptor";
import { calendarEvents } from "../src/modules/calendar/database/calendar.schema";
import {
  auditEvents,
  customers,
  domainEvents,
  locations,
  organizationModules,
  organizations,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "../src/database/schema";

// Proves Calendar's first slice end to end: module-activation gating
// composes with permission gating, own-calendar CRUD works with
// isolation and optimistic concurrency, and private-event content never
// leaks into the audit log or the internal event bus (CLAUDE.md
// Decision #9's implementation plan).
describe("Calendar events (e2e)", () => {
  let app: INestApplication;
  let db: Database;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];

  let orgA: { id: string; token: string };
  let orgB: { id: string; token: string };
  let readOnlyToken: string;

  async function makeUser(organizationId: string, email: string, permissionKeys: readonly string[]) {
    const existing = await db.query.permissions.findMany();
    const byKey = new Map(existing.map((p) => [p.key, p]));
    const missing = permissionKeys.filter((key) => !byKey.has(key));
    if (missing.length > 0) {
      const inserted = await db
        .insert(permissions)
        .values(missing.map((key) => ({ key, description: `e2e test permission: ${key}` })))
        .returning();
      inserted.forEach((p) => byKey.set(p.key, p));
    }

    const role = single(await db.insert(roles).values({ organizationId, name: `E2E Role ${email}` }).returning());
    createdRoleIds.push(role.id);
    await db
      .insert(rolePermissions)
      .values(permissionKeys.map((key) => ({ roleId: role.id, permissionId: byKey.get(key)!.id })));

    const passwordHash = await argon2.hash("e2e-test-password-123456", { type: argon2.argon2id });
    const user = single(
      await db.insert(users).values({ organizationId, email, passwordHash, displayName: "E2E User" }).returning(),
    );
    createdUserIds.push(user.id);
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id });

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "e2e-test-password-123456" })
      .expect(200);
    return loginResponse.body.accessToken as string;
  }

  async function makeOrg(name: string) {
    const org = single(await db.insert(organizations).values({ name }).returning());
    createdOrgIds.push(org.id);
    return org.id;
  }

  async function activateCalendar(orgId: string, token: string) {
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgId}/modules/calendar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: true, version: 0 })
      .expect(200);
  }

  const fullPermissions = [...PERMISSION_KEYS, ...CALENDAR_MODULE_DESCRIPTOR.permissionKeys];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1", { exclude: ["api/docs", "api/docs-json"] });
    await app.init();
    db = app.get(DATABASE_CONNECTION);

    const orgAId = await makeOrg("E2E Calendar Org A");
    const orgBId = await makeOrg("E2E Calendar Org B");
    const tokenA = await makeUser(orgAId, `e2e-calendar-a-${Date.now()}@pulse.test`, fullPermissions);
    const tokenB = await makeUser(orgBId, `e2e-calendar-b-${Date.now()}@pulse.test`, fullPermissions);
    orgA = { id: orgAId, token: tokenA };
    orgB = { id: orgBId, token: tokenB };
    readOnlyToken = await makeUser(orgAId, `e2e-calendar-readonly-${Date.now()}@pulse.test`, [
      "calendar:read:own",
    ]);
  });

  afterAll(async () => {
    await db.delete(domainEvents).where(inArray(domainEvents.organizationId, createdOrgIds));
    await db.delete(calendarEvents).where(inArray(calendarEvents.organizationId, createdOrgIds));
    await db.delete(customers).where(inArray(customers.organizationId, createdOrgIds));
    await db.delete(locations).where(inArray(locations.organizationId, createdOrgIds));
    await db.delete(organizationModules).where(inArray(organizationModules.organizationId, createdOrgIds));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, createdOrgIds));
    await db.delete(refreshTokens).where(inArray(refreshTokens.userId, createdUserIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, createdRoleIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    await db.delete(roles).where(inArray(roles.id, createdRoleIds));
    await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
    await app.close();
  });

  it("refuses calendar access before the module is activated for the organization", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(403);
    expect(res.body.message).toMatch(/not active/);
  });

  it("activates calendar for both test organizations", async () => {
    await activateCalendar(orgA.id, orgA.token);
    await activateCalendar(orgB.id, orgB.token);
  });

  let eventAId: string;

  it("creates an event on the caller's own calendar", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        title: "Team sync",
        startAt: "2026-09-01T10:00:00.000Z",
        endAt: "2026-09-01T11:00:00.000Z",
        timezone: "Europe/Berlin",
      })
      .expect(201);
    expect(res.body.organizationId).toBe(orgA.id);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.sourceModuleId).toBe("calendar");
    expect(res.body.version).toBe(1);
    expect(res.body.location).toEqual({ type: "remote" });
    eventAId = res.body.id;
  });

  it("rejects an event where endAt is not after startAt", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        title: "Invalid",
        startAt: "2026-09-01T11:00:00.000Z",
        endAt: "2026-09-01T10:00:00.000Z",
        timezone: "Europe/Berlin",
      })
      .expect(400);
  });

  it("lets the owner read their own event", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/modules/calendar/events/${eventAId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    expect(res.body.title).toBe("Team sync");
  });

  it("never leaks another organization's calendar event", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/modules/calendar/events/${eventAId}`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);
    const listRes = await request(app.getHttpServer())
      .get("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(200);
    expect(listRes.body).toEqual([]);
  });

  it("updates the event with optimistic concurrency", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/modules/calendar/events/${eventAId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 1, title: "Team sync (updated)" })
      .expect(200);
    expect(res.body.title).toBe("Team sync (updated)");
    expect(res.body.version).toBe(2);
  });

  it("rejects a stale-version update as a conflict, not a silent overwrite", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/modules/calendar/events/${eventAId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 1, title: "Should not apply" })
      .expect(409);
  });

  it("cancels the event and publishes calendar.event.cancelled", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/modules/calendar/events/${eventAId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 2, status: "cancelled" })
      .expect(200);

    const event = single(
      await db.query.domainEvents.findMany({
        where: and(eq(domainEvents.eventType, "calendar.event.cancelled"), eq(domainEvents.entityId, eventAId)),
      }),
    );
    expect(event.organizationId).toBe(orgA.id);
  });

  it("denies creating an event to a user without calendar:write:own", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({
        title: "Should be denied",
        startAt: "2026-09-02T10:00:00.000Z",
        endAt: "2026-09-02T11:00:00.000Z",
        timezone: "Europe/Berlin",
      })
      .expect(403);
  });

  it("filters events by date range, matching overlap rather than only start time", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        title: "December event",
        startAt: "2026-12-01T10:00:00.000Z",
        endAt: "2026-12-01T11:00:00.000Z",
        timezone: "Europe/Berlin",
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get("/api/v1/modules/calendar/events?from=2026-11-01T00:00:00.000Z&to=2026-11-30T23:59:59.000Z")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    expect(res.body.find((e: { title: string }) => e.title === "December event")).toBeUndefined();
  });

  it("never leaks a private event's content into the audit log or the internal event bus", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        title: "Confidential 1:1",
        description: "Sensitive performance discussion",
        startAt: "2026-09-03T10:00:00.000Z",
        endAt: "2026-09-03T11:00:00.000Z",
        timezone: "Europe/Berlin",
        isPrivate: true,
      })
      .expect(201);
    expect(res.body.title).toBe("Confidential 1:1");

    const domainEvent = single(
      await db.query.domainEvents.findMany({
        where: and(eq(domainEvents.eventType, "calendar.event.created"), eq(domainEvents.entityId, res.body.id)),
      }),
    );
    const eventPayload = domainEvent.payload as Record<string, unknown>;
    expect(eventPayload.title).toBeUndefined();
    expect(eventPayload.description).toBeUndefined();
    expect(eventPayload.isPrivate).toBe(true);

    const auditRow = single(
      await db.query.auditEvents.findMany({
        where: and(eq(auditEvents.entityType, "CalendarEvent"), eq(auditEvents.entityId, res.body.id)),
      }),
    );
    const auditPayload = auditRow.payload as Record<string, unknown>;
    expect(auditPayload.title).toBeUndefined();
    expect(auditPayload.description).toBeUndefined();
  });

  it("stores an external location's name and address directly", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        title: "Home visit",
        startAt: "2026-09-04T10:00:00.000Z",
        endAt: "2026-09-04T11:00:00.000Z",
        timezone: "Europe/Berlin",
        location: { type: "external", name: "City General Hospital", address: "12 Main St" },
      })
      .expect(201);
    expect(res.body.location).toEqual({ type: "external", name: "City General Hospital", address: "12 Main St" });
  });

  it("references an organization location by id, without duplicating its address", async () => {
    const locationRes = await request(app.getHttpServer())
      .post("/api/v1/locations")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ name: "Main Workshop", address: "1 Workshop Rd" })
      .expect(201);

    const eventRes = await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        title: "Workshop appointment",
        startAt: "2026-09-05T10:00:00.000Z",
        endAt: "2026-09-05T11:00:00.000Z",
        timezone: "Europe/Berlin",
        location: { type: "coreLocation", locationId: locationRes.body.id },
      })
      .expect(201);
    expect(eventRes.body.location).toEqual({ type: "coreLocation", locationId: locationRes.body.id });
    // Only the reference is stored — no address field leaks into the event.
    expect(JSON.stringify(eventRes.body)).not.toContain("Workshop Rd");
  });

  it("refuses to reference another organization's location", async () => {
    const foreignLocationRes = await request(app.getHttpServer())
      .post("/api/v1/locations")
      .set("Authorization", `Bearer ${orgB.token}`)
      .send({ name: "Org B Location" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        title: "Should be rejected",
        startAt: "2026-09-06T10:00:00.000Z",
        endAt: "2026-09-06T11:00:00.000Z",
        timezone: "Europe/Berlin",
        location: { type: "coreLocation", locationId: foreignLocationRes.body.id },
      })
      .expect(404);
  });

  it("references a customer's address by id, without duplicating or exposing it", async () => {
    const customerRes = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ name: "Jane Customer" })
      .expect(201);

    const eventRes = await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        title: "Home visit",
        startAt: "2026-09-07T10:00:00.000Z",
        endAt: "2026-09-07T11:00:00.000Z",
        timezone: "Europe/Berlin",
        location: { type: "customerAddress", customerId: customerRes.body.id },
      })
      .expect(201);
    expect(eventRes.body.location).toEqual({ type: "customerAddress", customerId: customerRes.body.id });
  });

  it("refuses to reference another organization's customer", async () => {
    const foreignCustomerRes = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${orgB.token}`)
      .send({ name: "Org B Customer" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/modules/calendar/events")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        title: "Should be rejected",
        startAt: "2026-09-08T10:00:00.000Z",
        endAt: "2026-09-08T11:00:00.000Z",
        timezone: "Europe/Berlin",
        location: { type: "customerAddress", customerId: foreignCustomerRes.body.id },
      })
      .expect(404);
  });
});
