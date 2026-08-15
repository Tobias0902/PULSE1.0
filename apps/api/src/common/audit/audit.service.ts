import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION, Database, DbClient } from "../../database/database.provider";
import { auditEvents } from "../../database/schema";

export interface RecordMutationInput {
  organizationId: string | null;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
  payload?: unknown;
}

// Append-only foundation for attributing mutations to a user (CLAUDE.md
// requirement E). This is a minimal foundation, not the full long-term
// audit/QM system.
@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  // `db` defaults to the global connection so every existing call site
  // keeps working unchanged; pass a transaction handle (see EventBusService)
  // to record the audit event atomically with the entity mutation it
  // describes. Only Case create/update and module activation do that so
  // far — see CLAUDE.md's foundation-iteration plan for why this isn't a
  // backfill across every entity yet.
  async recordMutation(input: RecordMutationInput, db: DbClient = this.db): Promise<void> {
    await db.insert(auditEvents).values({
      organizationId: input.organizationId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      payload: input.payload ?? null,
    });
  }
}
