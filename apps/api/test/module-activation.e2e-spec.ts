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

// Proves module activation end to end: dependency gating (both directions),
// optimistic concurrency, permission gating, and organization isolation of
// activation state — without a real business module, using two synthetic
// module rows seeded directly (test-base <- test-dependent).
describe("Module activation (e2e)", () => {
  let app: INestApplication;
  let db: Database;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];
  const createdModuleIds = ["test-base", "test-dependent"];

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

    const role = single(
      await db.insert(roles).values({ organizationId, name: `E2E Role ${email}` }).returning(),
    );
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1", { exclude: ["api/docs", "api/docs-json"] });
    await app.init();
    db = app.get(DATABASE_CONNECTION);

    await db
      .insert(modules)
      .values([
        { id: "test-base", name: "Test Base", version: "0.0.1", sdkVersion: "1", dependsOn: [] },
        { id: "test-dependent", name: "Test Dependent", version: "0.0.1", sdkVersion: "1", dependsOn: ["test-base"] },
      ])
      .onConflictDoNothing();

    const orgAId = await makeOrg("E2E Module Org A");
    const orgBId = await makeOrg("E2E Module Org B");
    const tokenA = await makeUser(orgAId, `e2e-module-a-${Date.now()}@pulse.test`, PERMISSION_KEYS);
    const tokenB = await makeUser(orgBId, `e2e-module-b-${Date.now()}@pulse.test`, PERMISSION_KEYS);
    orgA = { id: orgAId, token: tokenA };
    orgB = { id: orgBId, token: tokenB };
    readOnlyToken = await makeUser(orgAId, `e2e-module-readonly-${Date.now()}@pulse.test`, ["module:read"]);
  });

  afterAll(async () => {
    await db.delete(domainEvents).where(inArray(domainEvents.organizationId, createdOrgIds));
    await db.delete(organizationModules).where(inArray(organizationModules.organizationId, createdOrgIds));
    await db.delete(modules).where(inArray(modules.id, createdModuleIds));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, createdOrgIds));
    await db.delete(refreshTokens).where(inArray(refreshTokens.userId, createdUserIds));
    await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, createdRoleIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    await db.delete(roles).where(inArray(roles.id, createdRoleIds));
    await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
    await app.close();
  });

  it("lists the installation-wide module catalog, including core", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/modules")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["core", "test-base", "test-dependent"]));
  });

  it("refuses to activate a module whose dependency is not active", async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/modules/test-dependent`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ isActive: true, version: 0 })
      .expect(400);
    expect(res.body.message).toMatch(/test-base/);
  });

  it("activates a module with no unmet dependencies", async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/modules/test-base`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ isActive: true, version: 0 })
      .expect(200);
    expect(res.body.isActive).toBe(true);
    expect(res.body.version).toBe(1);
  });

  it("rejects a stale-version activation as a conflict, not a silent overwrite", async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/modules/test-base`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ isActive: false, version: 0 })
      .expect(409);

    const stillActive = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA.id}/modules`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    expect(stillActive.body.find((m: { moduleId: string }) => m.moduleId === "test-base").isActive).toBe(true);
  });

  it("now allows activating the dependent module", async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/modules/test-dependent`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ isActive: true, version: 0 })
      .expect(200);
    expect(res.body.isActive).toBe(true);
  });

  it("refuses to deactivate a module that an active module still depends on", async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/modules/test-base`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ isActive: false, version: 1 })
      .expect(400);
    expect(res.body.message).toMatch(/test-dependent/);
  });

  it("deactivates cleanly once the dependent is deactivated first, without deleting the catalog row", async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/modules/test-dependent`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/modules/test-base`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);

    const catalog = await request(app.getHttpServer())
      .get("/api/v1/modules")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);
    expect(catalog.body.find((m: { id: string }) => m.id === "test-base")).toBeDefined();
  });

  it("keeps activation state isolated per organization", async () => {
    const orgBList = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB.id}/modules`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(200);
    expect(orgBList.body.find((m: { moduleId: string }) => m.moduleId === "test-base")).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA.id}/modules`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);
  });

  it("denies activation to a user without module:write, independent of module state", async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA.id}/modules/test-base`)
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ isActive: true, version: 0 })
      .expect(403);
  });
});
