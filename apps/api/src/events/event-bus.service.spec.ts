import { EventBusService } from "./event-bus.service";

describe("EventBusService", () => {
  it("returns no handlers for an event type nothing has subscribed to", () => {
    const bus = new EventBusService();
    expect(bus.getHandlers("case.created")).toEqual([]);
  });

  it("returns every handler subscribed to an event type, in subscription order", () => {
    const bus = new EventBusService();
    const first = jest.fn();
    const second = jest.fn();
    bus.subscribe("case.created", first);
    bus.subscribe("case.created", second);
    expect(bus.getHandlers("case.created")).toEqual([first, second]);
  });

  it("keeps handlers for different event types independent", () => {
    const bus = new EventBusService();
    const caseHandler = jest.fn();
    const moduleHandler = jest.fn();
    bus.subscribe("case.created", caseHandler);
    bus.subscribe("module.activated", moduleHandler);
    expect(bus.getHandlers("case.created")).toEqual([caseHandler]);
    expect(bus.getHandlers("module.activated")).toEqual([moduleHandler]);
  });
});
