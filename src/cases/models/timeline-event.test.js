import { describe, expect, it } from "vitest";
import { TimelineEvent } from "./timeline-event.js";

describe("TimelineEvent", () => {
  describe("getUserIds", () => {
    it("returns array with createdBy user ID", () => {
      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.CASE_CREATED,
        createdBy: "user-123",
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(["user-123"]);
    });

    it("returns array with createdBy and assignedTo user IDs", () => {
      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.CASE_ASSIGNED,
        createdBy: "user-123",
        data: {
          assignedTo: "user-456",
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(expect.arrayContaining(["user-123", "user-456"]));
      expect(userIds).toHaveLength(2);
    });

    it("returns unique user IDs when createdBy and assignedTo are the same", () => {
      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.CASE_ASSIGNED,
        createdBy: "user-123",
        data: {
          assignedTo: "user-123",
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(["user-123"]);
      expect(userIds).toHaveLength(1);
    });

    it("returns only createdBy when data is null", () => {
      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.CASE_CREATED,
        createdBy: "user-123",
        data: null,
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(["user-123"]);
    });

    it("returns only createdBy when data is undefined", () => {
      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.CASE_CREATED,
        createdBy: "user-123",
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(["user-123"]);
    });

    it("returns only createdBy when data exists but assignedTo is missing", () => {
      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.TASK_COMPLETED,
        createdBy: "user-123",
        data: {
          taskId: "task-456",
          otherProperty: "value",
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(["user-123"]);
    });

    it("returns only createdBy when assignedTo is null", () => {
      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.CASE_UNASSIGNED,
        createdBy: "user-123",
        data: {
          assignedTo: null,
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(["user-123"]);
    });

    it("returns only createdBy when assignedTo is undefined", () => {
      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.CASE_ASSIGNED,
        createdBy: "user-123",
        data: {
          assignedTo: undefined,
        },
      });

      const userIds = timelineEvent.getUserIds();

      expect(userIds).toEqual(["user-123"]);
    });
  });
});
