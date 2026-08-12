// The audit log and the generic internal event bus have no per-subscriber
// authorization of their own (CLAUDE.md Decision #9's implementation
// plan) — so a private event's audit/event payload must already be the
// minimized shape by the time it's written, regardless of who might read
// it later. Full content only ever leaves through Calendar's own
// authorized API, never through these two side channels.
export function toAuditOrEventPayload<T extends { id: string; isPrivate: boolean; startAt: Date; endAt: Date }>(
  event: T,
  fullPayload: unknown,
): unknown {
  if (!event.isPrivate) return fullPayload;
  return { id: event.id, isPrivate: true, startAt: event.startAt, endAt: event.endAt };
}
