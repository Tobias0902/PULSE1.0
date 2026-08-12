import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { CreateLocationInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { locations } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { single } from "../common/single";

@Injectable()
export class LocationsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateLocationInput, actorUserId: string, organizationId: string) {
    const location = single(
      await this.db
        .insert(locations)
        .values({ ...input, organizationId, createdBy: actorUserId, updatedBy: actorUserId })
        .returning(),
    );
    await this.auditService.recordMutation({
      organizationId: location.organizationId,
      userId: actorUserId,
      entityType: "Location",
      entityId: location.id,
      action: "create",
      payload: input,
    });
    return location;
  }

  findByOrganization(organizationId: string) {
    return this.db.query.locations.findMany({
      where: eq(locations.organizationId, organizationId),
    });
  }

  async findOne(id: string, organizationId: string) {
    const location = await this.db.query.locations.findFirst({
      where: and(eq(locations.id, id), eq(locations.organizationId, organizationId)),
    });
    if (!location) throw new NotFoundException("Location not found.");
    return location;
  }
}
