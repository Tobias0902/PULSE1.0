import { toAuditOrEventPayload } from "./calendar-event-privacy";

const baseEvent = { id: "event-1", isPrivate: false, startAt: new Date("2026-01-01T10:00:00Z"), endAt: new Date("2026-01-01T11:00:00Z") };

describe("toAuditOrEventPayload", () => {
  it("passes the full payload through for a non-private event", () => {
    const fullPayload = { title: "Team sync", description: "Sensitive-ish but not private" };
    expect(toAuditOrEventPayload(baseEvent, fullPayload)).toBe(fullPayload);
  });

  it("minimizes to a busy-block shape for a private event, dropping every other field", () => {
    const privateEvent = { ...baseEvent, isPrivate: true };
    const fullPayload = { title: "Therapy appointment", description: "Confidential", location: "Clinic" };
    const result = toAuditOrEventPayload(privateEvent, fullPayload);
    expect(result).toEqual({
      id: privateEvent.id,
      isPrivate: true,
      startAt: privateEvent.startAt,
      endAt: privateEvent.endAt,
    });
  });
});
