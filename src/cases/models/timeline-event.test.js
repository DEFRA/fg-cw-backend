import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEnums } from "./event-enums.js";
import { TimelineEvent } from "./timeline-event.js";

describe("timeline-event", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create a timeline event", () => {
    vi.setSystemTime(new Date("2025-06-16T09:01:14.072Z"));

    const expected = TimelineEvent.createMock({
      eventType: EventEnums.eventTypes.TASK_COMPLETED,
      data: {
        someProp: "Some Value",
      },
    });

    expect(
      new TimelineEvent({
        eventType: EventEnums.eventTypes.TASK_COMPLETED,
        createdBy: "Mickey Mouse",
        data: {
          someProp: "Some Value",
        },
      }),
    ).toEqual(expected);
  });
});
