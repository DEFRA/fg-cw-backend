import { describe, expect, it } from "vitest";
import { EventEnums } from "./event-enums.js";
import { assertIsTimelineEvent, TimelineEvent } from "./timeline-event.js";

const createdBy = "9ce498ee43bb4bfe8ed31eae";
const assignedTo = "9ce498ee43bb4bfe8ed31ebb";
describe("TimelineEvent", () => {
  describe("getUserIds", () => {
    it("returns array with createdBy user ID", () => {
      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.CASE_CREATED,
        createdBy,
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual([createdBy]);
    });

    it("returns array with createdBy and assignedTo user IDs", () => {
      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.CASE_ASSIGNED,
        createdBy,
        data: {
          assignedTo,
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(expect.arrayContaining([createdBy, assignedTo]));
      expect(userIds).toHaveLength(2);
    });

    it("returns unique user IDs when createdBy and assignedTo are the same", () => {
      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.CASE_ASSIGNED,
        createdBy,
        data: {
          assignedTo: createdBy,
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual([createdBy]);
      expect(userIds).toHaveLength(1);
    });

    it("returns only createdBy when data is null", () => {
      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.CASE_CREATED,
        createdBy,
        data: null,
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual([createdBy]);
    });

    it("returns only createdBy when data is undefined", () => {
      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.CASE_CREATED,
        createdBy,
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual([createdBy]);
    });

    it("returns only createdBy when data exists but assignedTo is missing", () => {
      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.TASK_COMPLETED,
        createdBy,
        data: {
          taskId: "task-456",
          otherProperty: "value",
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual([createdBy]);
    });

    it("returns only createdBy when assignedTo is null", () => {
      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.CASE_UNASSIGNED,
        createdBy,
        data: {
          assignedTo: null,
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual([createdBy]);
    });

    it("returns only createdBy when assignedTo is undefined", () => {
      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.CASE_ASSIGNED,
        createdBy: "System",
        data: {
          assignedTo: undefined,
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(["System"]);
    });

    it("throws if timeline event is invalid", () => {
      expect(
        () =>
          new TimelineEvent({
            eventType: "BLAH",
            createdBy: "System",
            data: {
              assignedTo: undefined,
            },
          }),
      ).toThrowError(
        'Invalid TimelineEvent: "eventType" must be one of [CASE_CREATED, NOTE_ADDED, CASE_ASSIGNED, CASE_UNASSIGNED, SUBMISSION, TASK_COMPLETED, STAGE_COMPLETED]',
      );
    });
  });

  describe("assertIsTimelineEvent", () => {
    it("should validate object is timeline event", () => {
      const valid = TimelineEvent.createMock();
      const result = assertIsTimelineEvent(valid);
      expect(result).toBe(valid);
    });

    it("should throw bad request if when not a TimelineEvent", () => {
      const invalid = [
        {
          createdAt: new Date().toISOString(),
          eventType: EventEnums.eventTypes.CASE_ASSIGNED,
          data: {},
        },
        {},
        null,
        undefined,
      ];

      invalid.forEach((i) => {
        expect(() => assertIsTimelineEvent(i)).toThrow(
          "Must provide a valid TimelineEvent object",
        );
      });
    });
  });
});
