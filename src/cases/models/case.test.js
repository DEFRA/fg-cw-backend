import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { Case } from "./case.js";
import { Comment } from "./comment.js";
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
        createdBy: "user-2",
      });

      const comment2 = new Comment({
        type: "NOTE_ADDED",
        text: "Comment 2",
        createdBy: "user-3",
      });

      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.CASE_CREATED,
        createdBy: "user-4",
        data: { assignedTo: "user-5" },
      });

      const caseInstance = new Case({
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        assignedUser: { id: "user-1", name: "Test User" },
        payload: {},
        stages: [],
        comments: [comment1, comment2],
        timeline: [timelineEvent],
        requiredRoles: {},
      });

      const userIds = caseInstance.getUserIds();

      expect(userIds).toEqual(
        expect.arrayContaining([
          "user-1",
          "user-2",
          "user-3",
          "user-4",
          "user-5",
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
        createdBy: "user-1",
      });

      const timelineEvent = new TimelineEvent({
        eventType: TimelineEvent.eventTypes.CASE_CREATED,
        createdBy: "user-1",
      });

      const caseInstance = new Case({
        caseRef: "TEST-001",
        workflowCode: "FRPS",
        status: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentStage: "stage-1",
        assignedUser: { id: "user-1", name: "Test User" },
        payload: {},
        stages: [],
        comments: [comment],
        timeline: [timelineEvent],
        requiredRoles: {},
      });

      const userIds = caseInstance.getUserIds();

      expect(userIds).toEqual(["user-1"]);
      expect(userIds).toHaveLength(1);
    });
  });
});
