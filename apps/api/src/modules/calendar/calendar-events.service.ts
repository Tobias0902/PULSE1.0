import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { CalendarEventLocation, CreateCalendarEventInput, UpdateCalendarEventInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../../database/database.provider";
import { calendarEvents } from "./database/calendar.schema";
import { AuditService } from "../../common/audit/audit.service";
import { EventBusService } from "../../events/event-bus.service";
import { CustomersService } from "../../customers/customers.service";
import { LocationsService } from "../../locations/locations.service";
import { assertVersionedUpdateApplied } from "../../common/optimistic-lock";
import { single } from "../../common/single";
import { toAuditOrEventPayload } from "./calendar-event-privacy";
import { fromLocationColumns, toLocationColumns } from "./calendar-event-location";

type CalendarEventRow = typeof calendarEvents.$inferSelect;

@Injectable()
export class CalendarEventsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
    // Core's own services, injected for in-process reference validation
    // (CLAUDE.md Decision #7 §7) — never direct queries against Core's
    // customers/locations tables (Decision #7 §9).
    private readonly customersService: CustomersService,
    private readonly locationsService: LocationsService,
  ) {}

  // This iteration only supports a user's own calendar — cross-user
  // read/write (calendar:read:others / calendar:write:others) and full
  // private-event content filtering for *other* viewers land in a later
  // step, once there's a cross-user read path to enforce them against
  // (CLAUDE.md Decision #9's implementation plan). The owner always sees
  // their own full data regardless of isPrivate; only the audit/event-bus
  // side channels are minimized starting now, since they have no viewer
  // context of their own.
  async create(input: CreateCalendarEventInput, actorUserId: string, organizationId: string) {
    await this.assertLocationReferenceValid(input.location, organizationId);
    return this.db.transaction(async (tx) => {
      const { location, ...rest } = input;
      const event = single(
        await tx
          .insert(calendarEvents)
          .values({
            ...rest,
            ...toLocationColumns(location),
            organizationId,
            ownerUserId: actorUserId,
            startAt: new Date(input.startAt),
            endAt: new Date(input.endAt),
            createdBy: actorUserId,
            updatedBy: actorUserId,
          })
          .returning(),
      );
      const publicEvent = toPublicEvent(event);
      const payload = toAuditOrEventPayload(event, publicEvent);
      await this.auditService.recordMutation(
        { organizationId, userId: actorUserId, entityType: "CalendarEvent", entityId: event.id, action: "create", payload },
        tx,
      );
      await this.eventBus.publish(tx, {
        organizationId,
        eventType: "calendar.event.created",
        entityType: "CalendarEvent",
        entityId: event.id,
        payload,
      });
      return publicEvent;
    });
  }

  async findByOwner(ownerUserId: string, organizationId: string, from?: string, to?: string) {
    const conditions = [eq(calendarEvents.ownerUserId, ownerUserId), eq(calendarEvents.organizationId, organizationId)];
    // Range filter selects events that *overlap* [from, to], not only
    // ones that start inside it — a multi-day event starting before the
    // window must still show up.
    if (to) conditions.push(lte(calendarEvents.startAt, new Date(to)));
    if (from) conditions.push(gte(calendarEvents.endAt, new Date(from)));
    const rows = await this.db.query.calendarEvents.findMany({ where: and(...conditions) });
    return rows.map(toPublicEvent);
  }

  async findOne(id: string, ownerUserId: string, organizationId: string) {
    const event = await this.db.query.calendarEvents.findFirst({
      where: and(
        eq(calendarEvents.id, id),
        eq(calendarEvents.ownerUserId, ownerUserId),
        eq(calendarEvents.organizationId, organizationId),
      ),
    });
    if (!event) throw new NotFoundException("Calendar event not found.");
    return toPublicEvent(event);
  }

  async update(id: string, input: UpdateCalendarEventInput, actorUserId: string, organizationId: string) {
    const { version, startAt, endAt, location, ...changes } = input;
    if (location) await this.assertLocationReferenceValid(location, organizationId);

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(calendarEvents)
        .set({
          ...changes,
          ...(startAt ? { startAt: new Date(startAt) } : {}),
          ...(endAt ? { endAt: new Date(endAt) } : {}),
          ...(location ? toLocationColumns(location) : {}),
          updatedBy: actorUserId,
          updatedAt: new Date(),
          version: sql`${calendarEvents.version} + 1`,
        })
        .where(
          and(
            eq(calendarEvents.id, id),
            eq(calendarEvents.version, version),
            eq(calendarEvents.ownerUserId, actorUserId),
            eq(calendarEvents.organizationId, organizationId),
          ),
        )
        .returning();
      const event = assertVersionedUpdateApplied(updated, "CalendarEvent");
      const publicEvent = toPublicEvent(event);

      const eventType = changes.status === "cancelled" ? "calendar.event.cancelled" : "calendar.event.updated";
      const payload = toAuditOrEventPayload(event, { ...changes, ...(location ? { location } : {}) });
      await this.auditService.recordMutation(
        { organizationId, userId: actorUserId, entityType: "CalendarEvent", entityId: event.id, action: "update", payload },
        tx,
      );
      await this.eventBus.publish(tx, {
        organizationId,
        eventType,
        entityType: "CalendarEvent",
        entityId: event.id,
        payload,
      });
      return publicEvent;
    });
  }

  // Prevents referencing another organization's customer/location — the
  // same cross-org-reference class of bug the foundation iteration fixed
  // for Core's own entities. Both services already throw NotFoundException
  // (never leaking whether the id exists in a *different* org) when the
  // reference doesn't resolve within the caller's own organization.
  private async assertLocationReferenceValid(location: CalendarEventLocation, organizationId: string): Promise<void> {
    if (location.type === "customerAddress") {
      await this.customersService.findOne(location.customerId, organizationId);
    } else if (location.type === "coreLocation") {
      await this.locationsService.findOne(location.locationId, organizationId);
    }
  }
}

// The DB row stores location as flat, nullable columns (see
// calendar.schema.ts); every response to a client uses the nested
// discriminated-union shape instead.
function toPublicEvent(row: CalendarEventRow) {
  const { locationType, locationCustomerId, locationCoreLocationId, locationName, locationAddress, ...rest } = row;
  return { ...rest, location: fromLocationColumns({ locationType, locationCustomerId, locationCoreLocationId, locationName, locationAddress }) };
}
