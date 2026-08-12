import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import * as argon2 from "argon2";
import { CreateUserInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { users } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { single } from "../common/single";

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateUserInput, actorUserId: string, organizationId: string) {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = single(
      await this.db
        .insert(users)
        .values({
          organizationId,
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning(),
    );
    await this.auditService.recordMutation({
      organizationId: user.organizationId,
      userId: actorUserId,
      entityType: "User",
      entityId: user.id,
      action: "create",
      payload: { email: input.email, displayName: input.displayName },
    });
    return sanitize(user);
  }

  async findByOrganization(organizationId: string) {
    const rows = await this.db.query.users.findMany({
      where: eq(users.organizationId, organizationId),
    });
    return rows.map(sanitize);
  }
}

function sanitize(user: { passwordHash: string; [key: string]: unknown }) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
