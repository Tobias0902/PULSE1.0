import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { EMPTY_SETTINGS, UpdateLocationSettingsInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { locationSettings, locations } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { assertVersionedUpdateApplied } from "../common/optimistic-lock";

@Injectable()
export class LocationSettingsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async find(locationId: string, organizationId: string) {
    await this.assertOwnedLocation(locationId, organizationId);
    const row = await this.db.query.locationSettings.findFirst({
      where: eq(locationSettings.locationId, locationId),
    });
    return row ?? { locationId, settings: EMPTY_SETTINGS, version: 0, updatedAt: null, updatedBy: null };
  }

  async update(locationId: string, organizationId: string, input: UpdateLocationSettingsInput, actorUserId: string) {
    await this.assertOwnedLocation(locationId, organizationId);

    const now = new Date();
    const [row] = await this.db
      .insert(locationSettings)
      .values({ locationId, settings: input.settings, version: 1, updatedAt: now, updatedBy: actorUserId })
      .onConflictDoUpdate({
        target: locationSettings.locationId,
        set: {
          settings: input.settings,
          version: sql`${locationSettings.version} + 1`,
          updatedAt: now,
          updatedBy: actorUserId,
        },
        where: eq(locationSettings.version, input.version),
      })
      .returning();

    const result = assertVersionedUpdateApplied(row, "LocationSettings");
    await this.auditService.recordMutation({
      organizationId,
      userId: actorUserId,
      entityType: "LocationSettings",
      entityId: locationId,
      action: input.version === 0 ? "create" : "update",
      payload: input.settings,
    });
    return result;
  }

  private async assertOwnedLocation(locationId: string, organizationId: string): Promise<void> {
    const location = await this.db.query.locations.findFirst({ where: eq(locations.id, locationId) });
    if (!location || location.organizationId !== organizationId) {
      throw new NotFoundException("Location not found.");
    }
  }
}
