import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { CreateOrganizationInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { organizations } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { single } from "../common/single";

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateOrganizationInput, actorUserId: string) {
    const organization = single(
      await this.db
        .insert(organizations)
        .values({ name: input.name, createdBy: actorUserId, updatedBy: actorUserId })
        .returning(),
    );
    await this.auditService.recordMutation({
      organizationId: organization.id,
      userId: actorUserId,
      entityType: "Organization",
      entityId: organization.id,
      action: "create",
      payload: input,
    });
    return organization;
  }

  findAll() {
    return this.db.query.organizations.findMany();
  }

  findOne(id: string) {
    return this.db.query.organizations.findFirst({ where: eq(organizations.id, id) });
  }
}
