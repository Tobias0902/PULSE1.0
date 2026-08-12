import { Inject, Injectable, NotFoundException } from "@nestjs/common";
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

  // A user's JWT only ever carries one organizationId (see CLAUDE.md's open
  // "multiple internal organizations per installation" question) — until
  // that's resolved, "all organizations" for a request means "my own".
  findAll(organizationId: string) {
    return this.db.query.organizations.findMany({ where: eq(organizations.id, organizationId) });
  }

  async findOne(id: string, organizationId: string) {
    if (id !== organizationId) throw new NotFoundException("Organization not found.");
    const organization = await this.db.query.organizations.findFirst({ where: eq(organizations.id, id) });
    if (!organization) throw new NotFoundException("Organization not found.");
    return organization;
  }
}
