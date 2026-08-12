import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { DomainEvent } from "@pulse/module-contracts";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { domainEvents } from "../database/schema";
import { EventBusService } from "./event-bus.service";

// Named (rather than the anonymous @Interval(ms) form) so tests can stop
// it via SchedulerRegistry and drive dispatchBatch() deterministically
// instead of racing a real 1s timer.
export const EVENT_DISPATCH_INTERVAL_NAME = "event-dispatch";
const DISPATCH_INTERVAL_MS = 1000;
const BATCH_SIZE = 20;
// A row that has failed this many times is left unprocessed and stops
// being picked up — visible via attempts/lastError rather than retried
// forever. There is no read endpoint over domain_events yet (this
// iteration's foundation only), so "visible" today means queryable
// directly, not surfaced in any UI — a documented gap, not an oversight.
const MAX_ATTEMPTS = 5;

type DomainEventRow = typeof domainEvents.$inferSelect;

@Injectable()
export class EventDispatcherService {
  private readonly logger = new Logger(EventDispatcherService.name);
  private dispatching = false;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly eventBus: EventBusService,
  ) {}

  @Interval(EVENT_DISPATCH_INTERVAL_NAME, DISPATCH_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    // Skip overlapping ticks — FOR UPDATE SKIP LOCKED already makes
    // concurrent dispatchers (e.g. across processes) safe, but there is
    // no reason for this same process to run two ticks at once.
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      await this.dispatchBatch();
    } catch (error) {
      this.logger.error("Event dispatch batch failed", error instanceof Error ? error.stack : String(error));
    } finally {
      this.dispatching = false;
    }
  }

  // Split from handleInterval so tests can drive a single batch
  // deterministically instead of waiting on the timer.
  async dispatchBatch(batchSize = BATCH_SIZE): Promise<number> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(domainEvents)
        .where(and(isNull(domainEvents.processedAt), lt(domainEvents.attempts, MAX_ATTEMPTS)))
        .orderBy(domainEvents.occurredAt)
        .limit(batchSize)
        .for("update", { skipLocked: true });

      for (const row of rows) {
        const handlers = this.eventBus.getHandlers(row.eventType);
        try {
          const event = toDomainEvent(row);
          for (const handler of handlers) {
            await handler(event);
          }
          await tx.update(domainEvents).set({ processedAt: new Date() }).where(eq(domainEvents.id, row.id));
        } catch (error) {
          await tx
            .update(domainEvents)
            .set({
              attempts: sql`${domainEvents.attempts} + 1`,
              lastError: error instanceof Error ? error.message : String(error),
            })
            .where(eq(domainEvents.id, row.id));
        }
      }

      return rows.length;
    });
  }
}

function toDomainEvent(row: DomainEventRow): DomainEvent {
  return {
    id: row.id,
    organizationId: row.organizationId,
    eventType: row.eventType,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: row.payload,
    occurredAt: row.occurredAt.toISOString(),
    causationId: row.causationId,
    correlationId: row.correlationId,
  };
}
