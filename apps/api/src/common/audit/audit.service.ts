import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION, Database } from "../../database/database.provider";
import { auditEvents } from "../../database/schema";

export interface RecordMutationInput {
  organizationId: string | null;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: "create" | "update";
  payload?: unknown;
}

// Append-only foundation for attributing mutations to a user (CLAUDE.md
// requirement E). This is a minimal foundation, not the full long-term
// audit/QM system.
@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async recordMutation(input: RecordMutationInput): Promise<void> {
    await this.db.insert(auditEvents).values({
      organizationId: input.organizationId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      payload: input.payload ?? null,
    });
  }
}
