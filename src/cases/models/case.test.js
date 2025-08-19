import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { Case } from "./case.js";
import { Comment } from "./comment.js";
import { EventEnums } from "./event-enums.js";
import { TimelineEvent } from "./timeline-event.js";

describe("Case", () => {
  const validUserId = new ObjectId().toHexString();

  const createValidProps = () => ({
    _id: "64c88faac1f56f71e1b89a33",
    caseRef: "TEST-001",
    workflowCode: "FRPS",
    status: "NEW",
    dateReceived: "2025-01-01T00:00:00.000Z",
    currentStage: "stage-1",
    assignedUser: { id: validUserId, name: "Test User" },
    payload: { data: "test" },
    stages: [{ id: "stage-1", taskGroups: [] }],
    comments: [],
    timeline: [],
    requiredRoles: { allOf: ["ROLE_1"] },
  });

  const createTestCase = (props = createValidProps()) => {
    return new Case(props);
  };

  describe("constructor", () => {
    it("creates a case with all required properties", () => {
      const caseInstance = createTestCase();

      expect(caseInstance._id).toBe("64c88faac1f56f71e1b89a33");
      expect(caseInstance.caseRef).toBe("TEST-001");
      expect(caseInstance.workflowCode).toBe("FRPS");
      expect(caseInstance.status).toBe("NEW");
      expect(caseInstance.dateReceived).toBe("2025-01-01T00:00:00.000Z");
      expect(caseInstance.currentStage).toBe("stage-1");
      expect(caseInstance.assignedUser).toEqual({
        id: validUserId,
        name: "Test User",
      });
      expect(caseInstance.payload).toEqual({ data: "test" });
      expect(caseInstance.stages).toEqual([{ id: "stage-1", taskGroups: [] }]);
      expect(caseInstance.comments).toEqual([]);
      expect(caseInstance.timeline).toEqual([]);
      expect(caseInstance.requiredRoles).toEqual({ allOf: ["ROLE_1"] });
    });

    it("generates ObjectId when _id is not provided", () => {
      const caseInstance = createTestCase();

      expect(caseInstance._id).toBeDefined();
      expect(typeof caseInstance._id).toBe("string");
      expect(caseInstance._id).toHaveLength(24);
    });

    it("sets assignedUser to null when not provided", () => {
      const props = { ...createValidProps(), assignedUser: undefined };

      const caseInstance = createTestCase(props);

      expect(caseInstance.assignedUser).toBeNull();
    });

    it("sets timeline to empty array when not provided", () => {
      const props = { ...createValidProps(), timeline: undefined };
      const caseInstance = createTestCase(props);
      expect(caseInstance.timeline).toEqual([]);
    });

    it("validates comments array using assertIsCommentsArray", () => {
      const comment = new Comment({
        type: "NOTE_ADDED",
        text: "Test comment",
        createdBy: "user-1",
      });

      const props = {
        ...createValidProps(),
        comments: [comment],
      };

      const caseInstance = createTestCase(props);

      expect(caseInstance.comments).toEqual([comment]);
    });
  });

  describe("objectId getter", () => {
    it("returns ObjectId instance from hex string", () => {
      const hexId = "64c88faac1f56f71e1b89a33";
      const caseInstance = createTestCase({
        ...createValidProps(),
        _id: hexId,
      });
      const objectId = caseInstance.objectId;

      expect(objectId).toBeInstanceOf(ObjectId);
      expect(objectId.toHexString()).toBe(hexId);
    });
  });

  describe("assignUser", () => {
    it("assigns user and creates timeline event with comment", () => {
      const caseInstance = createTestCase();

      caseInstance.assignUser({
        assignedUserId: "user-123",
        text: "Assigning to user",
        createdBy: validUserId,
      });

      expect(caseInstance.assignedUserId).toBe("user-123");
      expect(caseInstance.assignedUser).toEqual({ id: "user-123" });
      expect(caseInstance.timeline).toHaveLength(1);
      expect(caseInstance.timeline[0].eventType).toBe(
        EventEnums.eventTypes.CASE_ASSIGNED,
      );
      expect(caseInstance.timeline[0].createdBy).toBe(validUserId);
      expect(caseInstance.timeline[0].data.assignedTo).toBe("user-123");
      expect(caseInstance.timeline[0].comment.text).toBe("Assigning to user");
      expect(caseInstance.comments).toHaveLength(1);
      expect(caseInstance.comments[0].text).toBe("Assigning to user");
    });

    it("assigns user without comment when text not provided", () => {
      const caseInstance = createTestCase();

      caseInstance.assignUser({
        assignedUserId: "user-123",
        createdBy: validUserId,
      });

      expect(caseInstance.assignedUserId).toBe("user-123");
      expect(caseInstance.timeline[0].comment).toBeNull();
      expect(caseInstance.comments).toHaveLength(0);
    });

    it("tracks previous assignment when reassigning", () => {
      const caseInstance = createTestCase();

      caseInstance.assignUser({
        assignedUserId: "user-new",
        createdBy: validUserId,
      });

      expect(caseInstance.timeline[0].data.previouslyAssignedTo).toBe(
        validUserId,
      );
      expect(caseInstance.timeline[0].data.assignedTo).toBe("user-new");
    });
  });

  describe("unassignUser", () => {
    it("unassigns user and creates unassignment timeline event", () => {
      const caseInstance = createTestCase();

      caseInstance.unassignUser({
        text: "Unassigning user",
        createdBy: validUserId,
      });

      expect(caseInstance.assignedUserId).toBeNull();
      expect(caseInstance.assignedUser).toBeNull();
      expect(caseInstance.timeline).toHaveLength(1);
      expect(caseInstance.timeline[0].eventType).toBe(
        EventEnums.eventTypes.CASE_UNASSIGNED,
      );
      expect(caseInstance.timeline[0].data.assignedTo).toBeNull();
      expect(caseInstance.timeline[0].data.previouslyAssignedTo).toBe(
        validUserId,
      );
      expect(caseInstance.timeline[0].comment.text).toBe("Unassigning user");
    });
  });

  describe("addNote", () => {
    it("adds note and creates timeline event", () => {
      const caseInstance = createTestCase();

      const comment = caseInstance.addNote({
        text: "General note",
        createdBy: validUserId,
      });

      expect(comment).toBeDefined();
      expect(comment.text).toBe("General note");
      expect(comment.type).toBe(EventEnums.eventTypes.NOTE_ADDED);
      expect(caseInstance.timeline).toHaveLength(1);
      expect(caseInstance.timeline[0].eventType).toBe(
        EventEnums.eventTypes.NOTE_ADDED,
      );
      expect(caseInstance.timeline[0].comment).toBe(comment);
      expect(caseInstance.comments).toHaveLength(1);
      expect(caseInstance.comments[0]).toBe(comment);
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

      const caseInstance = createTestCase({
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
      const caseInstance = createTestCase({
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

      const caseInstance = createTestCase({
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
});
