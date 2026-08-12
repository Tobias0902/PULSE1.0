import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { EMPTY_SETTINGS, UpdateOrganizationSettingsInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { organizationSettings } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { assertVersionedUpdateApplied } from "../common/optimistic-lock";

@Injectable()
export class OrganizationSettingsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async find(organizationId: string) {
    const row = await this.db.query.organizationSettings.findFirst({
      where: eq(organizationSettings.organizationId, organizationId),
    });
    // No row yet means default (empty) settings, not an error — a fresh
    // organization is usable without anyone having to create one first.
    return row ?? { organizationId, settings: EMPTY_SETTINGS, version: 0, updatedAt: null, updatedBy: null };
  }

  async update(organizationId: string, input: UpdateOrganizationSettingsInput, actorUserId: string) {
    const now = new Date();
    const [row] = await this.db
      .insert(organizationSettings)
      .values({ organizationId, settings: input.settings, version: 1, updatedAt: now, updatedBy: actorUserId })
      .onConflictDoUpdate({
        target: organizationSettings.organizationId,
        set: {
          settings: input.settings,
          version: sql`${organizationSettings.version} + 1`,
          updatedAt: now,
          updatedBy: actorUserId,
        },
        where: eq(organizationSettings.version, input.version),
      })
      .returning();

    const result = assertVersionedUpdateApplied(row, "OrganizationSettings");
    await this.auditService.recordMutation({
      organizationId,
      userId: actorUserId,
      entityType: "OrganizationSettings",
      entityId: organizationId,
      action: input.version === 0 ? "create" : "update",
      payload: input.settings,
    });
    return result;
  }
}
