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
        'Invalid TimelineEvent: "eventType" must be one of [CASE_CREATED, CASE_ASSIGNED, CASE_UNASSIGNED, TASK_COMPLETED, STAGE_COMPLETED, NOTE_ADDED]',
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

  describe("createTimelineEvent", () => {
    it("creates timeline event with comment when text provided", () => {
      const props = {
        eventType: EventEnums.eventTypes.NOTE_ADDED,
        text: "Test note",
        data: { key: "value" },
        createdBy: "64c88faac1f56f71e1b89a33",
      };

      const timelineEvent = TimelineEvent.create(props);

      expect(timelineEvent.eventType).toBe(EventEnums.eventTypes.NOTE_ADDED);
      expect(timelineEvent.createdBy).toBe("64c88faac1f56f71e1b89a33");
      expect(timelineEvent.data).toEqual({ key: "value" });
      expect(timelineEvent.comment).toBeDefined();
      expect(timelineEvent.comment.text).toBe("Test note");
      expect(timelineEvent.comment.type).toBe(EventEnums.eventTypes.NOTE_ADDED);
    });

    it("creates timeline event without comment when text not provided", () => {
      const props = {
        eventType: EventEnums.eventTypes.CASE_CREATED,
        createdBy: "System",
      };

      const timelineEvent = TimelineEvent.create(props);

      expect(timelineEvent.eventType).toBe(EventEnums.eventTypes.CASE_CREATED);
      expect(timelineEvent.createdBy).toBe("System");
      expect(timelineEvent.comment).toBeNull();
    });
  });

  describe("createAssignUserEvent", () => {
    it("creates assignment timeline event with comment", () => {
      const props = {
        eventType: EventEnums.eventTypes.CASE_ASSIGNED,
        data: {
          assignedTo: "64c88faac1f56f71e1b89a34",
          previouslyAssignedTo: null,
        },
        text: "Assignment note",
        createdBy: "64c88faac1f56f71e1b89a33",
      };

      const timelineEvent = TimelineEvent.createAssignUser(props);

      expect(timelineEvent.eventType).toBe(EventEnums.eventTypes.CASE_ASSIGNED);
      expect(timelineEvent.data.assignedTo).toBe("64c88faac1f56f71e1b89a34");
      expect(timelineEvent.comment.text).toBe("Assignment note");
      expect(timelineEvent.comment.type).toBe(
        EventEnums.eventTypes.CASE_ASSIGNED,
      );
    });

    it("creates assignment timeline event without comment", () => {
      const props = {
        eventType: EventEnums.eventTypes.CASE_ASSIGNED,
        data: {
          assignedTo: "64c88faac1f56f71e1b89a34",
          previouslyAssignedTo: null,
        },
        createdBy: "64c88faac1f56f71e1b89a33",
      };

      const timelineEvent = TimelineEvent.createAssignUser(props);

      expect(timelineEvent.eventType).toBe(EventEnums.eventTypes.CASE_ASSIGNED);
      expect(timelineEvent.data.assignedTo).toBe("64c88faac1f56f71e1b89a34");
      expect(timelineEvent.comment).toBe(null);
    });

    it("creates unassignment timeline event with comment", () => {
      const props = {
        eventType: EventEnums.eventTypes.CASE_UNASSIGNED,
        data: {
          assignedTo: null,
          previouslyAssignedTo: "64c88faac1f56f71e1b89a34",
        },
        text: "Unassignment note",
        createdBy: "System",
      };

      const timelineEvent = TimelineEvent.createAssignUser(props);

      expect(timelineEvent.eventType).toBe(
        EventEnums.eventTypes.CASE_UNASSIGNED,
      );
      expect(timelineEvent.data.previouslyAssignedTo).toBe(
        "64c88faac1f56f71e1b89a34",
      );
      expect(timelineEvent.comment.text).toBe("Unassignment note");
      expect(timelineEvent.comment.type).toBe(
        EventEnums.eventTypes.CASE_UNASSIGNED,
      );
    });

    it("creates unassignment timeline event without comment", () => {
      const props = {
        eventType: EventEnums.eventTypes.CASE_UNASSIGNED,
        data: {
          assignedTo: null,
          previouslyAssignedTo: "64c88faac1f56f71e1b89a34",
        },
        createdBy: "System",
      };

      const timelineEvent = TimelineEvent.createAssignUser(props);

      expect(timelineEvent.eventType).toBe(
        EventEnums.eventTypes.CASE_UNASSIGNED,
      );
      expect(timelineEvent.data.previouslyAssignedTo).toBe(
        "64c88faac1f56f71e1b89a34",
      );
      expect(timelineEvent.comment).toBeNull();
    });
  });

  describe("createNoteAddedEvent", () => {
    it("creates note added timeline event", () => {
      const props = {
        text: "General note",
        createdBy: "64c88faac1f56f71e1b89a33",
      };

      const timelineEvent = TimelineEvent.createNoteAdded(props);

      expect(timelineEvent.eventType).toBe(EventEnums.eventTypes.NOTE_ADDED);
      expect(timelineEvent.createdBy).toBe("64c88faac1f56f71e1b89a33");
      expect(timelineEvent.comment).toBeDefined();
      expect(timelineEvent.comment.text).toBe("General note");
      expect(timelineEvent.comment.type).toBe(EventEnums.eventTypes.NOTE_ADDED);
    });
  });

  describe("createStageCompleteEvent", () => {
    it("creates a stage complete event", () => {
      const props = {
        data: {
          stageId: "64c88faac1f56f71e1b99999",
          actionId: "approve",
        },
        text: "Stage complete",
        createdBy: "64c88faac1f56f71e1b89a33",
      };

      const timelineEvent = TimelineEvent.createStageCompleted(props);
      expect(timelineEvent.eventType).toBe(
        EventEnums.eventTypes.STAGE_COMPLETED,
      );
      expect(timelineEvent.comment.text).toBe("Stage complete");
      expect(timelineEvent.data.stageId).toBe("64c88faac1f56f71e1b99999");
      expect(timelineEvent.data.actionId).toBe("approve");
    });
  });

  describe("createTaskCompleted", () => {
    it("creates a task complete event", () => {
      const props = {
        data: {
          taskId: "64c88faac1f56f71e1b99999",
        },
        text: "Task complete",
        createdBy: "64c88faac1f56f71e1b89a33",
      };

      const timelineEvent = TimelineEvent.createTaskCompleted(props);
      expect(timelineEvent.eventType).toBe(
        EventEnums.eventTypes.TASK_COMPLETED,
      );
      expect(timelineEvent.comment.text).toBe("Task complete");
      expect(timelineEvent.data.taskId).toBe("64c88faac1f56f71e1b99999");
    });
  });
});
