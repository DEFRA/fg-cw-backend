import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { Case } from "./case.js";
import { Comment } from "./comment.js";
import { EventEnums } from "./event-enums.js";
import { TimelineEvent } from "./timeline-event.js";

describe("Case", () => {
  describe("constructor", () => {
    it("creates a case with all required properties", () => {
      const props = {
        _id: "64c88faac1f56f71e1b89a33",
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        assignedUser: { id: "user-1", name: "Test User" },
        payload: { data: "test" },
        stages: [{ id: "stage-1", taskGroups: [] }],
        comments: [],
        timeline: [],
        requiredRoles: { allOf: ["ROLE_1"] },
      };

      const caseInstance = new Case(props);

      expect(caseInstance._id).toBe("64c88faac1f56f71e1b89a33");
      expect(caseInstance.caseRef).toBe("TEST-001");
      expect(caseInstance.workflowCode).toBe("FRPS");
      expect(caseInstance.status).toBe("NEW");
      expect(caseInstance.dateReceived).toBe("2025-01-01T00:00:00.000Z");
      expect(caseInstance.currentStage).toBe("stage-1");
      expect(caseInstance.assignedUser).toEqual({
        id: "user-1",
        name: "Test User",
      });
      expect(caseInstance.payload).toEqual({ data: "test" });
      expect(caseInstance.stages).toEqual([{ id: "stage-1", taskGroups: [] }]);
      expect(caseInstance.comments).toEqual([]);
      expect(caseInstance.timeline).toEqual([]);
      expect(caseInstance.requiredRoles).toEqual({ allOf: ["ROLE_1"] });
    });

    it("generates ObjectId when _id is not provided", () => {
      const props = {
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        payload: {},
        stages: [],
        comments: [],
        requiredRoles: {},
      };

      const caseInstance = new Case(props);

      expect(caseInstance._id).toBeDefined();
      expect(typeof caseInstance._id).toBe("string");
      expect(caseInstance._id).toHaveLength(24);
    });

    it("sets assignedUser to null when not provided", () => {
      const props = {
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        payload: {},
        stages: [],
        comments: [],
        requiredRoles: {},
      };

      const caseInstance = new Case(props);

      expect(caseInstance.assignedUser).toBeNull();
    });

    it("sets timeline to empty array when not provided", () => {
      const props = {
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        payload: {},
        stages: [],
        comments: [],
        requiredRoles: {},
      };

      const caseInstance = new Case(props);

      expect(caseInstance.timeline).toEqual([]);
    });

    it("validates comments array using assertIsCommentsArray", () => {
      const comment = new Comment({
        type: "NOTE_ADDED",
        text: "Test comment",
        createdBy: "user-1",
      });

      const props = {
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        payload: {},
        stages: [],
        comments: [comment],
        requiredRoles: {},
      };

      const caseInstance = new Case(props);

      expect(caseInstance.comments).toEqual([comment]);
    });
  });

  describe("objectId getter", () => {
    it("returns ObjectId instance from hex string", () => {
      const hexId = "64c88faac1f56f71e1b89a33";
      const caseInstance = new Case({
        _id: hexId,
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        payload: {},
        stages: [],
        comments: [],
        requiredRoles: {},
      });

      const objectId = caseInstance.objectId;

      expect(objectId).toBeInstanceOf(ObjectId);
      expect(objectId.toHexString()).toBe(hexId);
    });
  });

  describe("addComment", () => {
    it("adds valid comment to comments array", () => {
      const caseInstance = new Case({
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        payload: {},
        stages: [],
        comments: [],
        requiredRoles: {},
      });

      const comment = new Comment({
        type: "NOTE_ADDED",
        text: "Test comment",
        createdBy: "user-1",
      });

      const result = caseInstance.addComment(comment);

      expect(result).toBe(comment);
      expect(caseInstance.comments).toContain(comment);
      expect(caseInstance.comments).toHaveLength(1);
    });

    it("throws bad request when adding invalid comment", () => {
      const caseInstance = new Case({
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        payload: {},
        stages: [],
        comments: [],
        requiredRoles: {},
      });

      expect(() => caseInstance.addComment("not a comment")).toThrow(
        "Must provide a valid Comment object",
      );
    });
  });

  describe("getUserIds", () => {
    it("returns unique user IDs from assignedUser, timeline, and comments", () => {
      const comment1 = new Comment({
        type: "NOTE_ADDED",
        text: "Comment 1",
        createdBy: "AA0999099909090FF9898989",
      });

      const comment2 = new Comment({
        type: "NOTE_ADDED",
        text: "Comment 2",
        createdBy: "BB0999099909090FF9898989",
      });

      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.CASE_CREATED,
        createdBy: "090999099909090FF9898989",
        data: { assignedTo: "FF0999099909090FF9898989" },
      });

      const caseInstance = new Case({
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        assignedUser: { id: "EE0999099909090FF9898989", name: "Test User" },
        payload: {},
        stages: [],
        comments: [comment1, comment2],
        timeline: [timelineEvent],
        requiredRoles: {},
      });

      const userIds = caseInstance.getUserIds();

      expect(userIds).toEqual(
        expect.arrayContaining([
          "090999099909090FF9898989",
          "FF0999099909090FF9898989",
          "EE0999099909090FF9898989",
          "AA0999099909090FF9898989",
          "BB0999099909090FF9898989",
        ]),
      );
      expect(userIds).toHaveLength(5);
      expect(new Set(userIds)).toHaveProperty("size", 5);
    });

    it("returns empty array when no users are associated", () => {
      const caseInstance = new Case({
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        assignedUser: null,
        payload: {},
        stages: [],
        comments: [],
        timeline: [],
        requiredRoles: {},
      });

      const userIds = caseInstance.getUserIds();

      expect(userIds).toEqual([]);
    });

    it("handles duplicate user IDs across different sources", () => {
      const comment = new Comment({
        type: "NOTE_ADDED",
        text: "Comment",
        createdBy: "AAAAAAAAAAAAAAAAAAAAAAAA",
      });

      const timelineEvent = new TimelineEvent({
        eventType: EventEnums.eventTypes.CASE_CREATED,
        createdBy: "AAAAAAAAAAAAAAAAAAAAAAAA",
      });

      const caseInstance = new Case({
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        assignedUser: { id: "AAAAAAAAAAAAAAAAAAAAAAAA", name: "Test User" },
        payload: {},
        stages: [],
        comments: [comment],
        timeline: [timelineEvent],
        requiredRoles: {},
      });

      const userIds = caseInstance.getUserIds();

      expect(userIds).toEqual(["AAAAAAAAAAAAAAAAAAAAAAAA"]);
      expect(userIds).toHaveLength(1);
    });
  });

  describe("updateTaskStatus", () => {
    it("should find task", () => {
      const kase = Case.createMock();
      expect(kase.findTask("stage-1", "stage-1-tasks", "task-1")).toEqual({
        id: "task-1",
        status: "pending",
      });
    });

    it("should throw if taskgroup doesn't exist", () => {
      const kase = Case.createMock();
      expect(() =>
        kase.findTask("stage-1", "stage-2-tasks", "task-1"),
      ).toThrowError(
        "Can not find Task with id task-1 from taskGroup stage-2-tasks in stage stage-1",
      );
    });

    it("should throw if stage doesn't exist", () => {
      const kase = Case.createMock();
      expect(() =>
        kase.findTask("stage-unknown", "stage-1-tasks", "task-1"),
      ).toThrowError(
        "Can not find Task with id task-1 from taskGroup stage-1-tasks in stage stage-unknown",
      );
    });

    it("should update stage", () => {
      let task;
      const kase = Case.createMock();
      task = kase.findTask("stage-1", "stage-1-tasks", "task-1");
      expect(task.status).toBe("pending");
      expect(task.commentRef).toBeUndefined();

      kase.updateTaskStatus(
        "stage-1",
        "stage-1-tasks",
        "task-1",
        "complete",
        "This is a note",
      );
      task = kase.findTask("stage-1", "stage-1-tasks", "task-1");
      expect(task.status).toBe("complete");
      expect(task.commentRef).toBeDefined();
    });
  });

  describe("assignUser", () => {
    it("should assign user with no note", () => {
      const kase = Case.createMock();
      expect(kase.assignedUser.id).toBe("64c88faac1f56f71e1b89a33");
      kase.assignUser("11118faac1f56f71e1b00000", "aaaa8faac1f56f71e1b44444");
      expect(kase.assignedUser.id).toBe("11118faac1f56f71e1b00000");
      expect(kase.timeline[0].eventType).toBe("CASE_ASSIGNED");
      expect(kase.timeline[0].data).toEqual({
        assignedTo: "11118faac1f56f71e1b00000",
        previouslyAssignedTo: "64c88faac1f56f71e1b89a33",
      });
      expect(kase.timeline[0].createdBy).toBe("aaaa8faac1f56f71e1b44444");
    });

    it("should assign user with note", () => {
      const kase = Case.createMock();
      expect(kase.assignedUser.id).toBe("64c88faac1f56f71e1b89a33");
      kase.assignUser(
        "11118faac1f56f71e1b00000",
        "aaaa8faac1f56f71e1b44444",
        "Note",
      );
      expect(kase.timeline[0].commentRef).toBeDefined();
      expect(kase.comments[0].text).toBe("Note");
    });
  });
});
