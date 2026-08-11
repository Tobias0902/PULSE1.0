import { Inject, Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { CreateRoleInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { roles, rolePermissions } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { single } from "../common/single";

@Injectable()
export class RolesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateRoleInput, actorUserId: string) {
    const role = single(
      await this.db
        .insert(roles)
        .values({
          organizationId: input.organizationId,
          name: input.name,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning(),
    );

    if (input.permissionIds.length > 0) {
      await this.db
        .insert(rolePermissions)
        .values(input.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })));
    }

    await this.auditService.recordMutation({
      organizationId: role.organizationId,
      userId: actorUserId,
      entityType: "Role",
      entityId: role.id,
      action: "create",
      payload: input,
    });

    return { ...role, permissionIds: input.permissionIds };
  }

  async findByOrganization(organizationId: string) {
    const rows = await this.db.query.roles.findMany({
      where: eq(roles.organizationId, organizationId),
    });
    if (rows.length === 0) return [];

    const grants = await this.db
      .select()
      .from(rolePermissions)
      .where(
        inArray(
          rolePermissions.roleId,
          rows.map((role) => role.id),
        ),
      );

    return rows.map((role) => ({
      ...role,
      permissionIds: grants
        .filter((grant) => grant.roleId === role.id)
        .map((grant) => grant.permissionId),
    }));
  }
}
