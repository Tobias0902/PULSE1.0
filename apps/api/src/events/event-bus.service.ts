import { Injectable } from "@nestjs/common";
import { DomainEvent, EventHandler, PublishEventInput } from "@pulse/module-contracts";
import { DbClient } from "../database/database.provider";
import { domainEvents } from "../database/schema";

@Injectable()
export class EventBusService {
  private readonly handlersByEventType = new Map<string, EventHandler[]>();

  // Must be called inside the same db.transaction(...) as the mutation
  // that caused the event — that is the whole transactional-outbox
  // guarantee (CLAUDE.md's event-foundation design). A crash between the
  // entity write and this insert rolls both back together instead of
  // silently losing the event.
  async publish<T>(tx: DbClient, input: PublishEventInput<T>): Promise<void> {
    await tx.insert(domainEvents).values({
      organizationId: input.organizationId,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      payload: input.payload,
      causationId: input.causationId ?? null,
      correlationId: input.correlationId ?? null,
    });
  }

  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    const handlers = this.handlersByEventType.get(eventType) ?? [];
    handlers.push(handler as EventHandler);
    this.handlersByEventType.set(eventType, handlers);
  }

  getHandlers(eventType: string): EventHandler[] {
    return this.handlersByEventType.get(eventType) ?? [];
  }
}

// Local alias so callers importing from this file don't need a second
// import from @pulse/module-contracts just for the event shape.
export type { DomainEvent };
