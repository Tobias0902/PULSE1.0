import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import * as argon2 from "argon2";
import { inArray } from "drizzle-orm";
import { PERMISSION_KEYS } from "@pulse/domain";
import { AppModule } from "../src/app.module";
import { DATABASE_CONNECTION, Database } from "../src/database/database.provider";
import { single } from "../src/common/single";
import {
  appointments,
  assistiveDevices,
  auditEvents,
  cases,
  customers,
  domainEvents,
  organizations,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "../src/database/schema";

// Proves CLAUDE.md principle #5 ("organization data must be strictly
// isolated") end to end, through the real HTTP surface with real JWTs —
// not just that the query filters compile. Every org-scoped entity
// (organizations, locations/users/roles/customers, and the denormalized
// assistiveDevices/cases/appointments chain) is exercised.
describe("Organization isolation (e2e)", () => {
  let app: INestApplication;
  let db: Database;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];

  let orgA: { id: string; token: string };
  let orgB: { id: string; token: string };
  let customerAId: string;
  let deviceAId: string;
  let caseAId: string;
  let appointmentAId: string;

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

    const role = single(
      await db.insert(roles).values({ organizationId: org.id, name: "E2E Admin" }).returning(),
    );
    createdRoleIds.push(role.id);
    await db
      .insert(rolePermissions)
      .values(PERMISSION_KEYS.map((key) => ({ roleId: role.id, permissionId: byKey.get(key)!.id })));

    const passwordHash = await argon2.hash("e2e-test-password-123456", { type: argon2.argon2id });
    const user = single(
      await db
        .insert(users)
        .values({ organizationId: org.id, email, passwordHash, displayName: "E2E Admin" })
        .returning(),
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
    // main.ts applies this outside of AppModule itself (see bootstrap()),
    // so a test-created app needs it set explicitly too.
    app.setGlobalPrefix("api/v1", { exclude: ["api/docs", "api/docs-json"] });
    await app.init();
    db = app.get(DATABASE_CONNECTION);

    orgA = await makeOrgWithAdmin("E2E Org A", `e2e-org-a-${Date.now()}@pulse.test`);
    orgB = await makeOrgWithAdmin("E2E Org B", `e2e-org-b-${Date.now()}@pulse.test`);

    const customerRes = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ organizationId: orgA.id, name: "Org A Customer" })
      .expect(201);
    customerAId = customerRes.body.id;

    const deviceRes = await request(app.getHttpServer())
      .post("/api/v1/assistive-devices")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ customerId: customerAId, label: "Org A Device" })
      .expect(201);
    deviceAId = deviceRes.body.id;

    const caseRes = await request(app.getHttpServer())
      .post("/api/v1/cases")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ assistiveDeviceId: deviceAId, title: "Org A Case" })
      .expect(201);
    caseAId = caseRes.body.id;

    const appointmentRes = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ caseId: caseAId, scheduledAt: new Date(Date.now() + 86_400_000).toISOString() })
      .expect(201);
    appointmentAId = appointmentRes.body.id;
  });

  afterAll(async () => {
    await db.delete(domainEvents).where(inArray(domainEvents.organizationId, createdOrgIds));
    await db.delete(appointments).where(inArray(appointments.organizationId, createdOrgIds));
    await db.delete(cases).where(inArray(cases.organizationId, createdOrgIds));
    await db.delete(assistiveDevices).where(inArray(assistiveDevices.organizationId, createdOrgIds));
    await db.delete(customers).where(inArray(customers.organizationId, createdOrgIds));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, createdOrgIds));
    await db.delete(refreshTokens).where(inArray(refreshTokens.userId, createdUserIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, createdRoleIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    await db.delete(roles).where(inArray(roles.id, createdRoleIds));
    await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
    await app.close();
  });

  it("never leaks another organization's customer via read endpoints", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/customers/${customerAId}`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);

    const listRes = await request(app.getHttpServer())
      .get("/api/v1/customers")
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(200);
    expect(listRes.body).toEqual([]);
  });

  it("prevents updating another organization's customer", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerAId}`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .send({ version: 1, name: "Hijacked" })
      .expect((res) => expect([404, 409]).toContain(res.status));
  });

  it("ignores a client-supplied organizationId and attaches new customers to the caller's own organization", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${orgB.token}`)
      .send({ organizationId: orgA.id, name: "Spoofed Customer" })
      .expect(201);
    expect(res.body.organizationId).toBe(orgB.id);

    // Org A must never see it, despite the spoofed body.
    const orgAList = await request(app.getHttpServer())
      .get("/api/v1/customers")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    expect(orgAList.body.find((c: { id: string }) => c.id === res.body.id)).toBeUndefined();
  });

  it("never leaks another organization's assistive device, case, or appointment", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/assistive-devices/${deviceAId}`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/cases/${caseAId}`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${appointmentAId}`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${appointmentAId}/trace`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);
  });

  it("refuses to create a case/device/appointment against another organization's parent entity", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/assistive-devices")
      .set("Authorization", `Bearer ${orgB.token}`)
      .send({ customerId: customerAId, label: "Cross-org device" })
      .expect(404);
    await request(app.getHttpServer())
      .post("/api/v1/cases")
      .set("Authorization", `Bearer ${orgB.token}`)
      .send({ assistiveDeviceId: deviceAId, title: "Cross-org case" })
      .expect(404);
    await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${orgB.token}`)
      .send({ caseId: caseAId, scheduledAt: new Date(Date.now() + 86_400_000).toISOString() })
      .expect(404);
  });

  it("scopes the organizations endpoint to the caller's own organization", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA.id}`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);

    const listRes = await request(app.getHttpServer())
      .get("/api/v1/organizations")
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(200);
    expect(listRes.body.map((o: { id: string }) => o.id)).toEqual([orgB.id]);
  });

  it("scopes users and roles listings to the caller's own organization", async () => {
    const usersRes = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(200);
    expect(usersRes.body.every((u: { organizationId: string }) => u.organizationId === orgB.id)).toBe(true);

    const rolesRes = await request(app.getHttpServer())
      .get("/api/v1/roles")
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(200);
    expect(rolesRes.body.every((r: { organizationId: string }) => r.organizationId === orgB.id)).toBe(true);
  });

  it("still allows the owning organization full access to its own data", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/customers/${customerAId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${appointmentAId}/trace`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
  });
});
