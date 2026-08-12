// Internal event bus contracts (CLAUDE.md Decision #7 §7). Delivery is
// at-least-once with per-entity ordering via occurredAt; there is no
// cross-entity ordering guarantee. Idempotency is each subscriber's own
// responsibility — the same expectation Decision #8 already sets for
// connectors, so a future connector subscribing to this bus needs no new
// guarantee invented for it.
export interface DomainEvent<T = unknown> {
  id: string;
  organizationId: string | null;
  eventType: string;
  entityType: string | null;
  /** Opaque identifier, not necessarily a UUID — e.g. module ids are stable strings. */
  entityId: string | null;
  payload: T;
  occurredAt: string;
  causationId: string | null;
  correlationId: string | null;
}

export interface PublishEventInput<T = unknown> {
  organizationId: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload: T;
  causationId?: string | null;
  correlationId?: string | null;
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void;

export interface EventPublisher {
  /**
   * Must be called inside the same transaction as the mutation that caused
   * the event — that is the transactional-outbox guarantee this bus exists
   * to provide. The `tx` type is intentionally left to the implementation
   * (apps/api's EventBusService) since it is a Drizzle/Postgres-specific
   * transaction handle, not something this contracts package should know
   * the shape of.
   */
  publish<T>(tx: unknown, input: PublishEventInput<T>): Promise<void>;
}

export interface EventSubscriber {
  subscribe<T>(eventType: string, handler: EventHandler<T>): void;
}
