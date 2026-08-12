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
  auditEvents,
  locationSettings,
  locations,
  organizationSettings,
  organizations,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "../src/database/schema";

describe("Organization/location settings (e2e)", () => {
  let app: INestApplication;
  let db: Database;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];

  let orgA: { id: string; token: string };
  let orgB: { id: string; token: string };
  let locationAId: string;

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

    orgA = await makeOrgWithAdmin("E2E Settings Org A", `e2e-settings-a-${Date.now()}@pulse.test`);
    orgB = await makeOrgWithAdmin("E2E Settings Org B", `e2e-settings-b-${Date.now()}@pulse.test`);

    const locationRes = await request(app.getHttpServer())
      .post("/api/v1/locations")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ name: "Org A Main Location" })
      .expect(201);
    locationAId = locationRes.body.id;
  });

  afterAll(async () => {
    // Scoped by createdOrgIds (always populated once an org exists) rather
    // than locationAId directly: if beforeAll fails partway through (as it
    // did once, on a schema bug this test caught), locationAId can be
    // undefined, and a delete keyed on it must not abort the rest of this
    // cleanup chain and leak the organizations/users it did create.
    const orgLocations = await db.query.locations.findMany({
      where: inArray(locations.organizationId, createdOrgIds),
    });
    const orgLocationIds = orgLocations.map((location) => location.id);
    await db.delete(organizationSettings).where(inArray(organizationSettings.organizationId, createdOrgIds));
    await db.delete(locationSettings).where(inArray(locationSettings.locationId, orgLocationIds));
    await db.delete(locations).where(inArray(locations.organizationId, createdOrgIds));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, createdOrgIds));
    await db.delete(refreshTokens).where(inArray(refreshTokens.userId, createdUserIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, createdRoleIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    await db.delete(roles).where(inArray(roles.id, createdRoleIds));
    await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
    await app.close();
  });

  it("returns default empty settings for a fresh organization, without a stored row", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA.id}/settings`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    expect(res.body).toMatchObject({
      organizationId: orgA.id,
      settings: { terminology: {}, features: {} },
      version: 0,
      updatedAt: null,
    });
  });

  it("creates organization settings on first write and updates them on subsequent writes", async () => {
    const created = await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/settings`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ settings: { terminology: { case: "Fallakte" }, features: {} }, version: 0 })
      .expect(200);
    expect(created.body.version).toBe(1);
    expect(created.body.settings.terminology.case).toBe("Fallakte");

    const updated = await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/settings`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ settings: { terminology: { case: "Auftrag" }, features: { "crm.enabled": true } }, version: 1 })
      .expect(200);
    expect(updated.body.version).toBe(2);
    expect(updated.body.settings.terminology.case).toBe("Auftrag");
  });

  it("rejects a stale-version write as a conflict, not a silent overwrite", async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/settings`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ settings: { terminology: {}, features: {} }, version: 1 })
      .expect(409);

    const current = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA.id}/settings`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    expect(current.body.version).toBe(2);
  });

  it("never leaks or allows writing another organization's settings", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA.id}/settings`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/settings`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .send({ settings: { terminology: {}, features: {} }, version: 2 })
      .expect(404);
  });

  it("supports location settings the same way, scoped to the location's own organization", async () => {
    const initial = await request(app.getHttpServer())
      .get(`/api/v1/locations/${locationAId}/settings`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    expect(initial.body.version).toBe(0);

    const updated = await request(app.getHttpServer())
      .put(`/api/v1/locations/${locationAId}/settings`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ settings: { terminology: { case: "Standort-Auftrag" }, features: {} }, version: 0 })
      .expect(200);
    expect(updated.body.version).toBe(1);

    await request(app.getHttpServer())
      .get(`/api/v1/locations/${locationAId}/settings`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .put(`/api/v1/locations/${locationAId}/settings`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .send({ settings: { terminology: {}, features: {} }, version: 1 })
      .expect(404);
  });
});
