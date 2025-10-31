import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it } from "vitest";
import { CasePhase } from "./case-phase.js";
import { CaseStage } from "./case-stage.js";
import { CaseTaskGroup } from "./case-task-group.js";
import { CaseTask } from "./case-task.js";
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
    currentPhase: "phase-1",
    currentStage: "stage-1",
    currentStatus: "NEW",
    dateReceived: "2025-01-01T00:00:00.000Z",
    assignedUser: { id: validUserId, name: "Test User" },
    payload: { data: "test" },
    phases: [
      new CasePhase({
        code: "phase-1",
        name: "Phase 1",
        stages: [
          new CaseStage({
            code: "stage-1",
            name: "Stage 1 name",
            description: "Stage 1 description",
            taskGroups: [],
          }),
        ],
      }),
    ],
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
      expect(caseInstance.currentPhase).toBe("phase-1");
      expect(caseInstance.currentStage).toBe("stage-1");
      expect(caseInstance.currentStatus).toBe("NEW");
      expect(caseInstance.dateReceived).toBe("2025-01-01T00:00:00.000Z");
      expect(caseInstance.assignedUser).toEqual({
        id: validUserId,
        name: "Test User",
      });
      expect(caseInstance.payload).toEqual({ data: "test" });
      expect(caseInstance.phases[0].stages).toEqual([
        { code: "stage-1", taskGroups: [] },
      ]);
      expect(caseInstance.comments).toEqual([]);
      expect(caseInstance.timeline).toEqual([]);
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

      const kase = Case.createMock();

      kase.comments = [comment1, comment2];
      kase.timeline = [timelineEvent];

      const userIds = kase.getUserIds();

      expect(userIds).toEqual(
        expect.arrayContaining([
          kase.assignedUser.id,
          "090999099909090FF9898989",
          "FF0999099909090FF9898989",
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
        dateReceived: "2025-01-01T00:00:00.000Z",
        currentPhase: "phase-1",
        currentStage: "stage-1",
        currentStatus: "NEW",
        assignedUser: null,
        payload: {},
        phases: [],
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

      const kase = Case.createMock();

      kase.assignedUser = {
        id: "AAAAAAAAAAAAAAAAAAAAAAAA",
      };

      kase.comments = [comment];
      kase.timeline = [timelineEvent];

      const userIds = kase.getUserIds();

      expect(userIds).toEqual(["AAAAAAAAAAAAAAAAAAAAAAAA"]);
      expect(userIds).toHaveLength(1);
    });
  });

  describe("setTaskStatus", () => {
    it("should update status", () => {
      const kase = Case.createMock();

      const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];

      expect(task.status).toBe("pending");
      expect(task.commentRef).toBeUndefined();

      kase.setTaskStatus({
        phaseCode: "phase-1",
        stageCode: "stage-1",
        taskGroupCode: "task-group-1",
        taskCode: "task-1",
        status: "complete",
        comment: "This is a note",
        updatedBy: "099999999999999999999999",
      });

      expect(task.status).toBe("complete");
      expect(task.commentRef).toBeDefined();
    });
  });

  describe("addSupplementaryData", () => {
    it("should add a new agreement to supplementaryData", () => {
      const createdAt = new Date().toISOString();
      const kase = Case.createMock();
      const agreement = {
        agreementStatus: "OFFERED",
        agreementRef: "ref-1",
        createdAt,
      };
      kase.addSupplementaryData("agreements", [agreement]);
      expect(kase.supplementaryData.agreements[0]).toBe(agreement);
    });
  });

  describe("assignUser", () => {
    it("should assign user with no note", () => {
      const kase = Case.createMock();
      expect(kase.assignedUserId).toBeUndefined();
      kase.assignUser({
        assignedUserId: "11118faac1f56f71e1b00000",
        createdBy: "aaaa8faac1f56f71e1b44444",
      });
      expect(kase.assignedUserId).toBe("11118faac1f56f71e1b00000");
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
      kase.assignUser({
        assignedUserId: "11118faac1f56f71e1b00000",
        createdBy: "aaaa8faac1f56f71e1b44444",
        text: "Note",
      });
      expect(kase.timeline[0].comment).toBeDefined();
      expect(kase.comments[0].text).toBe("Note");
    });
  });

  describe("findPhase", () => {
    it("finds phase", () => {
      const kase = Case.createMock();
      const phase = kase.findPhase("phase-1");
      expect(phase).toBeDefined();
    });

    it("throws 404 if phase not found", () => {
      const kase = Case.createMock();
      expect(() => kase.findPhase("phase-100")).toThrow(
        "Case with caseRef case-ref and workflowCode workflow-code does not have a phase with code phase-100",
      );
    });
  });

  describe("findComment", () => {
    it("finds comment by reference", () => {
      const props = createValidProps();
      props.comments = [
        {
          ref: "64c88faac1f56f71e1b89a30",
          type: "NOTE_ADDED",
          text: "First comment",
          createdBy: validUserId,
        },
        {
          ref: "64c88faac1f56f71e1b89a31",
          type: "NOTE_ADDED",
          text: "Second comment",
          createdBy: validUserId,
        },
      ];
      const caseInstance = createTestCase(props);

      const foundComment = caseInstance.findComment("64c88faac1f56f71e1b89a31");

      expect(foundComment).toBeDefined();
      expect(foundComment.ref).toBe("64c88faac1f56f71e1b89a31");
      expect(foundComment.text).toBe("Second comment");
    });

    it("returns undefined when comment not found", () => {
      const caseInstance = createTestCase();

      const foundComment = caseInstance.findComment("non-existent");

      expect(foundComment).toBeUndefined();
    });

    it("returns undefined for null reference", () => {
      const props = createValidProps();
      props.comments = [
        {
          ref: "64c88faac1f56f71e1b89a32",
          type: "NOTE_ADDED",
          text: "First comment",
          createdBy: validUserId,
        },
      ];
      const caseInstance = createTestCase(props);

      const foundComment = caseInstance.findComment(null);

      expect(foundComment).toBeUndefined();
    });
  });

  describe("updateStageOutcome", () => {
    let caseInstance;

    beforeEach(() => {
      const props = createValidProps();
      props.phases = [
        new CasePhase({
          code: "phase-1",
          stages: [
            new CaseStage({
              code: "stage-1",
              taskGroups: [
                new CaseTaskGroup({
                  code: "task-group-1",
                  tasks: [
                    new CaseTask({
                      code: "task-1",
                      status: "complete",
                      updatedAt: null,
                      updatedBy: null,
                      commentRef: null,
                    }),
                  ],
                }),
              ],
            }),
            new CaseStage({
              code: "stage-2",
              taskGroups: [],
            }),
          ],
        }),
      ];
      caseInstance = createTestCase(props);
    });

    it("updates stage outcome with comment and creates timeline event", () => {
      caseInstance.updateStageOutcome({
        actionCode: "approve",
        comment: "Application approved successfully",
        createdBy: validUserId,
      });

      const currentStage = caseInstance.phases[0].stages[0];
      expect(currentStage.outcome).toBeDefined();
      expect(currentStage.outcome.actionCode).toBe("approve");
      expect(currentStage.outcome.createdBy).toBe(validUserId);
      expect(currentStage.outcome.createdAt).toBeDefined();
      expect(currentStage.outcome.commentRef).toBeDefined();

      expect(caseInstance.timeline).toHaveLength(1);
      expect(caseInstance.timeline[0].eventType).toBe("STAGE_COMPLETED");
      expect(caseInstance.timeline[0].data.actionCode).toBe("approve");
      expect(caseInstance.timeline[0].data.stageCode).toBe("stage-1");

      expect(caseInstance.comments).toHaveLength(1);
      expect(caseInstance.comments[0].text).toBe(
        "Application approved successfully",
      );
    });

    it("updates stage outcome without comment", () => {
      caseInstance.updateStageOutcome({
        actionCode: "reject",
        comment: null,
        createdBy: validUserId,
      });

      const currentStage = caseInstance.phases[0].stages[0];
      expect(currentStage.outcome).toBeDefined();
      expect(currentStage.outcome.actionCode).toBe("reject");
      expect(currentStage.outcome.commentRef).toBeUndefined();

      expect(caseInstance.timeline).toHaveLength(1);
      expect(caseInstance.timeline[0].comment).toBeNull();
      expect(caseInstance.comments).toHaveLength(0);
    });

    it("progresses to next stage when action is approve", () => {
      expect(caseInstance.currentStage).toBe("stage-1");

      caseInstance.updateStageOutcome({
        actionCode: "approve",
        comment: "Moving to next stage",
        createdBy: validUserId,
      });

      expect(caseInstance.currentStage).toBe("stage-2");
    });

    it("does not progress stage when action is not approve", () => {
      expect(caseInstance.currentStage).toBe("stage-1");

      caseInstance.updateStageOutcome({
        actionCode: "on-hold",
        comment: "Application on hold",
        createdBy: validUserId,
      });

      expect(caseInstance.currentStage).toBe("stage-1");
    });

    it("throws error when trying to progress from last stage", () => {
      caseInstance.currentStage = "stage-2";

      expect(() => {
        caseInstance.updateStageOutcome({
          actionCode: "approve",
          comment: "Cannot progress further",
          createdBy: validUserId,
        });
      }).toThrow("Cannot progress case");
    });

    it("throws error when tasks are not complete for progression", () => {
      const props = createValidProps();
      props.phases = [
        new CasePhase({
          stages: [
            new CaseStage({
              code: "stage-1",
              taskGroups: [
                new CaseTaskGroup({
                  code: "task-group-1",
                  tasks: [
                    new CaseTask({
                      code: "task-1",
                      status: "pending",
                    }),
                  ],
                }),
              ],
            }),
            new CaseStage({
              code: "stage-2",
              taskGroups: [],
            }),
          ],
        }),
      ];
      const caseWithIncompleteTasks = createTestCase(props);

      expect(() => {
        caseWithIncompleteTasks.updateStageOutcome({
          actionCode: "approve",
          comment: "Trying to progress with incomplete tasks",
          createdBy: validUserId,
        });
      }).toThrow("some tasks are not complete");
    });

    it("throws error when current stage is not found", () => {
      caseInstance.currentStage = "non-existent-stage";

      expect(() => {
        caseInstance.updateStageOutcome({
          actionCode: "approve",
          comment: "Invalid stage",
          createdBy: validUserId,
        });
      }).toThrow("Cannot find current stage index");
    });

    it("updates outcome with correct createdAt timestamp", () => {
      const beforeUpdate = new Date();

      caseInstance.updateStageOutcome({
        actionCode: "approve",
        comment: "Test timestamp",
        createdBy: validUserId,
      });

      const afterUpdate = new Date();
      const currentStage = caseInstance.phases[0].stages[0];
      const createdAt = new Date(currentStage.outcome.createdAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });

    it("links comment correctly when comment is provided", () => {
      caseInstance.updateStageOutcome({
        actionCode: "approve",
        comment: "Test comment linking",
        createdBy: validUserId,
      });

      const currentStage = caseInstance.phases[0].stages[0];
      const commentRef = currentStage.outcome.commentRef;
      const linkedComment = caseInstance.findComment(commentRef);

      expect(linkedComment).toBeDefined();
      expect(linkedComment.text).toBe("Test comment linking");
      expect(linkedComment.type).toBe("STAGE_COMPLETED");
    });
  });

  describe("updateStatus", () => {
    it("updates status to APPROVED and creates timeline event", () => {
      const caseInstance = createTestCase();
      expect(caseInstance.currentStatus).toBe("NEW");
      expect(caseInstance.timeline).toHaveLength(0);

      caseInstance.updateStatus("APPROVED", validUserId);

      expect(caseInstance.currentStatus).toBe("APPROVED");
      expect(caseInstance.timeline).toHaveLength(1);
      expect(caseInstance.timeline[0].eventType).toBe(
        EventEnums.eventTypes.CASE_APPROVED,
      );
      expect(caseInstance.timeline[0].createdBy).toBe(validUserId);
      expect(caseInstance.timeline[0].data.status).toBe("APPROVED");
    });

    it("creates timeline event with correct properties when status is APPROVED", () => {
      const caseInstance = createTestCase();
      const beforeUpdate = new Date();

      caseInstance.updateStatus("APPROVED", validUserId);

      const afterUpdate = new Date();
      const timelineEvent = caseInstance.timeline[0];

      expect(timelineEvent.eventType).toBe(EventEnums.eventTypes.CASE_APPROVED);
      expect(timelineEvent.createdBy).toBe(validUserId);
      expect(timelineEvent.data).toEqual({ status: "APPROVED" });
      expect(timelineEvent.description).toBe("Case approved");
      expect(timelineEvent.comment).toBeNull();

      const createdAt = new Date(timelineEvent.createdAt);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });
  });
});
