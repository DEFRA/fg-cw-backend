import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CasePhase } from "./case-phase.js";
import { CaseStage } from "./case-stage.js";
import { CaseTaskGroup } from "./case-task-group.js";
import { CaseTask } from "./case-task.js";
import { Case } from "./case.js";
import { Comment } from "./comment.js";
import { EventEnums } from "./event-enums.js";
import { Position } from "./position.js";
import { TimelineEvent } from "./timeline-event.js";
import { WorkflowAction } from "./workflow-action.js";
import { WorkflowTransition } from "./workflow-transition.js";
import { Workflow } from "./workflow.js";

describe("Case", () => {
  const validUserId = new ObjectId().toHexString();

  const createValidProps = () => ({
    _id: "64c88faac1f56f71e1b89a33",
    caseRef: "TEST-001",
    workflowCode: "FRPS",
    position: new Position({
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      statusCode: "STATUS_1",
    }),
    dateReceived: "2025-01-01T00:00:00.000Z",
    assignedUser: { id: validUserId, name: "Test User" },
    payload: { data: "test" },
    phases: [
      new CasePhase({
        code: "PHASE_1",
        name: "Phase 1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
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
      expect(caseInstance.position).toEqual(
        new Position({
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        }),
      );
      expect(caseInstance.dateReceived).toBe("2025-01-01T00:00:00.000Z");
      expect(caseInstance.assignedUser).toEqual({
        id: validUserId,
        name: "Test User",
      });
      expect(caseInstance.payload).toEqual({ data: "test" });
      expect(caseInstance.phases[0].stages).toEqual([
        { code: "STAGE_1", taskGroups: [] },
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

  describe("getSupplementaryDataNode", () => {
    it("should get data node if it exists", () => {
      const agreements = {};
      const caseInstance = createTestCase();
      caseInstance.supplementaryData = {
        agreements,
      };

      expect(caseInstance.getSupplementaryDataNode("agreements")).toEqual(
        agreements,
      );
    });
  });

  describe("updateSupplementaryData", () => {
    it("should add data when it deosn't exists", () => {
      const caseInstance = createTestCase();
      const data = {
        targetNode: "foo",
        dataType: "ARRAY",
        data: {
          someKey: "someValue",
        },
      };
      caseInstance.updateSupplementaryData(data);
      expect(caseInstance.supplementaryData.foo).toBeDefined();
      expect(caseInstance.supplementaryData.foo).toHaveLength(1);
    });

    it("should add data as object when it doesn't exist", () => {
      const caseInstance = createTestCase();
      const data = {
        targetNode: "foo",
        dataType: "OBJECT",
        key: "someKey",
        data: {
          someKey: "someValue",
        },
      };
      caseInstance.updateSupplementaryData(data);
      expect(caseInstance.supplementaryData.foo).toBeDefined();
    });
  });

  describe("updateSupplementaryDataObject", () => {
    it("should throw if no key is provided", () => {
      const caseInstance = createTestCase();
      try {
        caseInstance.updateSupplementaryDataObject({
          targetData: {},
          targetNode: "Foo",
          data: {
            someData: "barr",
          },
        });
      } catch (e) {
        expect(e.message).toBe(
          'Can not update supplementaryData "Foo" as an object without a key',
        );
      }
    });

    it("should add data at key within object", () => {
      const caseInstance = createTestCase();
      const result = caseInstance.updateSupplementaryDataObject({
        targetData: {},
        key: "dataRef",
        targetNode: "Foo",
        data: {
          dataRef: "REF-1234-5678",
          someData: "barr",
        },
      });
      expect(result["REF-1234-5678"]).toBeDefined();
      expect(result["REF-1234-5678"].someData).toBe("barr");
    });
  });

  describe("updateSupplementaryDataArray", () => {
    it("should add element to array if does not exist", () => {
      const caseInstance = createTestCase();
      const result = caseInstance.updateSupplementaryDataArray({
        targetData: [],
        key: undefined,
        data: { agreementRef: "1234" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].agreementRef).toBe("1234");
    });

    it("should add new element to existing", () => {
      const caseInstance = createTestCase();
      const result = caseInstance.updateSupplementaryDataArray({
        targetData: [{ agreementRef: "1234", foo: "foo" }],
        key: "agreementRef",
        data: { agreementRef: "5678", foo: "barr" },
      });
      expect(result).toHaveLength(2);
      expect(result[0].foo).toBe("foo");
      expect(result[1].agreementRef).toBe("5678");
    });

    it("should update existing ref", () => {
      const caseInstance = createTestCase();
      const result = caseInstance.updateSupplementaryDataArray({
        targetData: [
          { agreementRef: "5678" },
          { agreementRef: "1234", foo: "foo" },
        ],
        key: "agreementRef",
        data: { agreementRef: "1234", foo: "barr" },
      });
      expect(result).toHaveLength(2);
      expect(result[1].foo).toBe("barr");
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
        currentPhase: "PHASE_1",
        currentStage: "STAGE_1",
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

      expect(task.status).toBe("PENDING");
      expect(task.commentRef).toBeUndefined();

      kase.setTaskStatus({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: "COMPLETE",
        completed: true,
        comment: "This is a note",
        updatedBy: "099999999999999999999999",
      });

      expect(task.status).toBe("COMPLETE");
      expect(task.commentRef).toBeDefined();
    });

    it("should create TASK_UPDATED timeline event when task is not completed", () => {
      const kase = Case.createMock();
      const initialTimelineLength = kase.timeline.length;

      kase.setTaskStatus({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: "IN_PROGRESS",
        completed: false,
        comment: "Starting work on this task",
        updatedBy: "099999999999999999999999",
      });

      expect(kase.timeline).toHaveLength(initialTimelineLength + 1);
      const newEvent = kase.timeline[0];
      expect(newEvent.eventType).toBe(EventEnums.eventTypes.TASK_UPDATED);
      expect(newEvent.data).toEqual({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
      });
      expect(newEvent.comment.text).toBe("Starting work on this task");
    });

    it("should create TASK_COMPLETED timeline event when task is completed", () => {
      const kase = Case.createMock();
      const initialTimelineLength = kase.timeline.length;

      kase.setTaskStatus({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: "COMPLETE",
        completed: true,
        comment: "Task finished",
        updatedBy: "099999999999999999999999",
      });

      expect(kase.timeline).toHaveLength(initialTimelineLength + 1);
      const newEvent = kase.timeline[0];
      expect(newEvent.eventType).toBe(EventEnums.eventTypes.TASK_COMPLETED);
      expect(newEvent.data).toEqual({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
      });
      expect(newEvent.comment.text).toBe("Task finished");
    });

    it("should create timeline event without comment when comment is not provided", () => {
      const kase = Case.createMock();
      const initialTimelineLength = kase.timeline.length;

      kase.setTaskStatus({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: "IN_PROGRESS",
        completed: false,
        updatedBy: "099999999999999999999999",
      });

      expect(kase.timeline).toHaveLength(initialTimelineLength + 1);
      const newEvent = kase.timeline[0];
      expect(newEvent.eventType).toBe(EventEnums.eventTypes.TASK_UPDATED);
      expect(newEvent.comment).toBeNull();
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
      const phase = kase.findPhase("PHASE_1");
      expect(phase).toBeDefined();
    });

    it("throws 404 if phase not found", () => {
      const kase = Case.createMock();
      expect(() => kase.findPhase("PHASE_100")).toThrow(
        "Case with caseRef case-ref and workflowCode workflow-code does not have a phase with code PHASE_100",
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
    let kase;
    let workflow;

    beforeEach(() => {
      const props = createValidProps();
      props.phases = [
        new CasePhase({
          code: "PHASE_1",
          stages: [
            new CaseStage({
              code: "STAGE_1",
              taskGroups: [
                new CaseTaskGroup({
                  code: "TASK_GROUP_1",
                  tasks: [
                    new CaseTask({
                      code: "TASK_1",
                      status: "COMPLETE",
                      completed: true,
                      updatedAt: null,
                      updatedBy: null,
                      commentRef: null,
                    }),
                  ],
                }),
              ],
            }),
            new CaseStage({
              code: "STAGE_2",
              taskGroups: [],
            }),
          ],
        }),
      ];
      kase = createTestCase(props);
      workflow = Workflow.createMock();
    });

    it("updates stage outcome with comment and creates timeline event", () => {
      kase.updateStageOutcome({
        workflow,
        actionCode: "ACTION_1",
        comment: "Application approved successfully",
        createdBy: validUserId,
      });

      const currentStage = kase.phases[0].stages[0];
      expect(currentStage.outcome).toBeDefined();
      expect(currentStage.outcome.actionCode).toBe("ACTION_1");
      expect(currentStage.outcome.createdBy).toBe(validUserId);
      expect(currentStage.outcome.createdAt).toBeDefined();
      expect(currentStage.outcome.commentRef).toBeDefined();

      expect(kase.timeline).toHaveLength(1);
      expect(kase.timeline[0].eventType).toBe("STAGE_COMPLETED");
      expect(kase.timeline[0].data.actionCode).toBe("ACTION_1");
      expect(kase.timeline[0].data.stageCode).toBe("STAGE_1");

      expect(kase.comments).toHaveLength(1);
      expect(kase.comments[0].text).toBe("Application approved successfully");
    });

    it("updates stage outcome without comment", () => {
      kase.updateStageOutcome({
        workflow,
        actionCode: "ACTION_1",
        comment: null,
        createdBy: validUserId,
      });

      const currentStage = kase.phases[0].stages[0];
      expect(currentStage.outcome).toBeDefined();
      expect(currentStage.outcome.actionCode).toBe("ACTION_1");
      expect(currentStage.outcome.commentRef).toBeUndefined();

      expect(kase.timeline).toHaveLength(1);
      expect(kase.timeline[0].comment).toBeNull();
      expect(kase.comments).toHaveLength(0);
    });

    it("updates position based on workflow transition", () => {
      expect(kase.position.statusCode).toBe("STATUS_1");

      kase.updateStageOutcome({
        workflow,
        actionCode: "ACTION_1",
        comment: "Moving to next status",
        createdBy: validUserId,
      });

      expect(kase.position.phaseCode).toBe("PHASE_1");
      expect(kase.position.stageCode).toBe("STAGE_1");
      expect(kase.position.statusCode).toBe("STATUS_2");
    });

    it("returns early when position does not change", () => {
      const initialTimelineLength = kase.timeline.length;

      const getNextPositionSpy = vi
        .spyOn(workflow, "getNextPosition")
        .mockReturnValue(kase.position);

      kase.updateStageOutcome({
        workflow,
        actionCode: "SAME_POSITION",
        comment: "No change",
        createdBy: validUserId,
      });

      expect(kase.timeline).toHaveLength(initialTimelineLength);
      expect(kase.phases[0].stages[0].outcome).toBeUndefined();

      getNextPositionSpy.mockRestore();
    });

    it("throws error when stage is incomplete", () => {
      const props = createValidProps();
      props.phases = [
        new CasePhase({
          code: "PHASE_1",
          stages: [
            new CaseStage({
              code: "STAGE_1",
              taskGroups: [
                new CaseTaskGroup({
                  code: "TASK_GROUP_1",
                  tasks: [
                    new CaseTask({
                      code: "TASK_1",
                      status: "PENDING",
                      completed: false,
                    }),
                  ],
                }),
              ],
            }),
            new CaseStage({
              code: "STAGE_2",
              taskGroups: [],
            }),
          ],
        }),
      ];
      const caseWithIncompleteTasks = createTestCase(props);

      try {
        caseWithIncompleteTasks.updateStageOutcome({
          workflow,
          actionCode: "ACTION_1",
          comment: "Trying to progress with incomplete tasks",
          createdBy: validUserId,
        });
      } catch (e) {
        expect(e.message).toBe(
          "Cannot perform action ACTION_1 from position PHASE_1:STAGE_1:STATUS_1: required tasks are not complete",
        );
      }
    });

    it("throws error when action code does not exist", () => {
      expect(() => {
        kase.updateStageOutcome({
          workflow,
          actionCode: "NONEXISTENT_ACTION",
          comment: "Should fail",
          createdBy: validUserId,
        });
      }).toThrow(
        "Workflow workflow-code does not support transition from PHASE_1:STAGE_1:STATUS_1 with action NONEXISTENT_ACTION",
      );
    });

    it("updates outcome with correct createdAt timestamp", () => {
      const beforeUpdate = new Date();

      kase.updateStageOutcome({
        workflow,
        actionCode: "ACTION_1",
        comment: "Test timestamp",
        createdBy: validUserId,
      });

      const afterUpdate = new Date();
      const currentStage = kase.phases[0].stages[0];
      const createdAt = new Date(currentStage.outcome.createdAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });

    it("links comment correctly when comment is provided", () => {
      kase.updateStageOutcome({
        workflow,
        actionCode: "ACTION_1",
        comment: "Test comment linking",
        createdBy: validUserId,
      });

      const currentStage = kase.phases[0].stages[0];
      const commentRef = currentStage.outcome.commentRef;
      const linkedComment = kase.findComment(commentRef);

      expect(linkedComment).toBeDefined();
      expect(linkedComment.text).toBe("Test comment linking");
      expect(linkedComment.type).toBe("STAGE_COMPLETED");
    });
  });

  describe("getPermittedActions", () => {
    it("returns actions when stage is complete", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      const actions = kase.getPermittedActions(workflow);

      expect(actions).toHaveLength(1);
      expect(actions[0].code).toBe("ACTION_1");
      expect(actions[0].name).toBe("Action 1");
      expect(actions[0].checkTasks).toBe(true);
    });

    it("filters out actions with checkTasks when stage is incomplete", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "PENDING";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = false;

      const actions = kase.getPermittedActions(workflow);

      expect(actions).toHaveLength(0);
    });

    it("returns actions without checkTasks regardless of stage completion", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();

      const status = workflow.getStatus(kase.position);
      status.transitions.push(
        new WorkflowTransition({
          targetPosition: kase.position,
          action: new WorkflowAction({
            code: "ACTION_2",
            name: "Action 2",
            checkTasks: false,
          }),
        }),
      );

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "PENDING";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = false;

      const actions = kase.getPermittedActions(workflow);

      expect(actions).toHaveLength(1);
      expect(actions[0].code).toBe("ACTION_2");
    });
  });

  describe("progressTo", () => {
    it("does nothing when position is already the same", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();
      const initialPosition = kase.position;
      const initialTimelineLength = kase.timeline.length;

      kase.progressTo({
        position: initialPosition,
        workflow,
        createdBy: validUserId,
      });

      expect(kase.position).toEqual(initialPosition);
      expect(kase.timeline).toHaveLength(initialTimelineLength);
    });

    it("throws error when stage is incomplete", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "PENDING";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = false;

      const newPosition = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_2",
        statusCode: "STATUS_1",
      });

      try {
        kase.progressTo({
          position: newPosition,
          workflow,
          createdBy: validUserId,
        });
      } catch (e) {
        expect(e.message).toBe(
          "Case with case-ref and workflowCode workflow-code cannot transition from PHASE_1:STAGE_1:STATUS_1 to PHASE_1:STAGE_2:STATUS_1: all mandatory tasks must be completed",
        );
      }
    });

    it("creates CASE_STATUS_CHANGED event when transitioning to different status", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();
      const initialTimelineLength = kase.timeline.length;

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      const newPosition = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "STATUS_2",
      });

      kase.progressTo({
        position: newPosition,
        workflow,
        createdBy: validUserId,
      });

      expect(kase.timeline).toHaveLength(initialTimelineLength + 1);
      expect(kase.timeline[0].eventType).toBe(
        EventEnums.eventTypes.CASE_STATUS_CHANGED,
      );
      expect(kase.timeline[0].data).toEqual({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "STATUS_2",
      });
      expect(kase.timeline[0].createdBy).toBe(validUserId);
      expect(kase.position).toEqual(newPosition);
    });

    it("creates STAGE_COMPLETED event when transitioning to different stage", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();
      const initialTimelineLength = kase.timeline.length;

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      const newPosition = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_2",
        statusCode: "STATUS_1",
      });

      kase.progressTo({
        position: newPosition,
        workflow,
        createdBy: validUserId,
      });

      expect(kase.timeline).toHaveLength(initialTimelineLength + 2);

      const stageCompletedEvent = kase.timeline.find(
        (event) => event.eventType === EventEnums.eventTypes.STAGE_COMPLETED,
      );
      expect(stageCompletedEvent).toBeDefined();
      expect(stageCompletedEvent.data).toEqual({
        actionCode: null,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "STATUS_1",
      });
      expect(stageCompletedEvent.createdBy).toBe(validUserId);
      expect(stageCompletedEvent.comment).toBeNull();
    });

    it("creates PHASE_COMPLETED event when transitioning to different phase", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();
      const initialTimelineLength = kase.timeline.length;

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      kase.phases.push(
        new CasePhase({
          code: "PHASE_2",
          stages: [
            new CaseStage({
              code: "STAGE_1",
              taskGroups: [],
            }),
          ],
        }),
      );

      const newPosition = new Position({
        phaseCode: "PHASE_2",
        stageCode: "STAGE_1",
        statusCode: "STATUS_1",
      });

      kase.progressTo({
        position: newPosition,
        workflow,
        createdBy: validUserId,
      });

      expect(kase.timeline).toHaveLength(initialTimelineLength + 3);

      const phaseCompletedEvent = kase.timeline.find(
        (event) => event.eventType === EventEnums.eventTypes.PHASE_COMPLETED,
      );
      expect(phaseCompletedEvent).toBeDefined();
      expect(phaseCompletedEvent.data).toEqual({
        phaseCode: "PHASE_1",
      });
      expect(phaseCompletedEvent.createdBy).toBe(validUserId);
    });

    it("creates all three events when transitioning to different phase and stage", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();
      const initialTimelineLength = kase.timeline.length;

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      kase.phases.push(
        new CasePhase({
          code: "PHASE_2",
          stages: [
            new CaseStage({
              code: "STAGE_3",
              taskGroups: [],
            }),
          ],
        }),
      );

      const newPosition = new Position({
        phaseCode: "PHASE_2",
        stageCode: "STAGE_3",
        statusCode: "STATUS_3",
      });

      kase.progressTo({
        position: newPosition,
        workflow,
        createdBy: validUserId,
      });

      expect(kase.timeline).toHaveLength(initialTimelineLength + 3);

      const eventTypes = kase.timeline
        .slice(0, 3)
        .map((event) => event.eventType);

      expect(eventTypes).toContain(EventEnums.eventTypes.PHASE_COMPLETED);
      expect(eventTypes).toContain(EventEnums.eventTypes.STAGE_COMPLETED);
      expect(eventTypes).toContain(EventEnums.eventTypes.CASE_STATUS_CHANGED);
    });

    it("updates position after successful transition", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      kase.phases.push(
        new CasePhase({
          code: "PHASE_2",
          stages: [
            new CaseStage({
              code: "STAGE_2",
              taskGroups: [],
            }),
          ],
        }),
      );

      const newPosition = new Position({
        phaseCode: "PHASE_2",
        stageCode: "STAGE_2",
        statusCode: "STATUS_2",
      });

      kase.progressTo({
        position: newPosition,
        workflow,
        createdBy: validUserId,
      });

      expect(kase.position).toEqual(newPosition);
    });

    it("does not create PHASE_COMPLETED event when staying in same phase", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      const newPosition = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_2",
        statusCode: "STATUS_1",
      });

      kase.progressTo({
        position: newPosition,
        workflow,
        createdBy: validUserId,
      });

      const phaseCompletedEvent = kase.timeline.find(
        (event) => event.eventType === EventEnums.eventTypes.PHASE_COMPLETED,
      );
      expect(phaseCompletedEvent).toBeUndefined();
    });

    it("does not create STAGE_COMPLETED event when staying in same stage", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      const newPosition = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "STATUS_2",
      });

      kase.progressTo({
        position: newPosition,
        workflow,
        createdBy: validUserId,
      });

      const stageCompletedEvent = kase.timeline.find(
        (event) => event.eventType === EventEnums.eventTypes.STAGE_COMPLETED,
      );
      expect(stageCompletedEvent).toBeUndefined();

      const statusChangedEvent = kase.timeline.find(
        (event) =>
          event.eventType === EventEnums.eventTypes.CASE_STATUS_CHANGED,
      );
      expect(statusChangedEvent).toBeDefined();
    });

    it("creates timeline events in correct order", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      kase.phases.push(
        new CasePhase({
          code: "PHASE_2",
          stages: [
            new CaseStage({
              code: "STAGE_2",
              taskGroups: [],
            }),
          ],
        }),
      );

      const newPosition = new Position({
        phaseCode: "PHASE_2",
        stageCode: "STAGE_2",
        statusCode: "STATUS_2",
      });

      kase.progressTo({
        position: newPosition,
        workflow,
        createdBy: validUserId,
      });

      expect(kase.timeline[0].eventType).toBe(
        EventEnums.eventTypes.CASE_STATUS_CHANGED,
      );
      expect(kase.timeline[1].eventType).toBe(
        EventEnums.eventTypes.STAGE_COMPLETED,
      );
      expect(kase.timeline[2].eventType).toBe(
        EventEnums.eventTypes.PHASE_COMPLETED,
      );
    });
  });

  describe("Case.new", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("creates a new case with initial setup", () => {
      const caseRef = "NEW-CASE-001";
      const workflowCode = "TEST-WORKFLOW";
      const position = Position.from("PHASE_1:STAGE_1:STATUS_1");
      const payload = { data: "test payload" };
      const phases = [
        new CasePhase({
          code: "PHASE_1",
          stages: [
            new CaseStage({
              code: "STAGE_1",
              taskGroups: [],
            }),
          ],
        }),
      ];

      const kase = Case.new({
        caseRef,
        workflowCode,
        position,
        payload,
        phases,
      });

      expect(kase.caseRef).toBe(caseRef);
      expect(kase.workflowCode).toBe(workflowCode);
      expect(kase.position).toEqual(position);
      expect(kase.payload).toEqual(payload);
      expect(kase.phases).toEqual(phases);
      expect(kase.supplementaryData).toEqual({});
      expect(kase.dateReceived).toBeDefined();
    });

    it("creates CASE_CREATED timeline event", () => {
      const caseRef = "NEW-CASE-002";
      const workflowCode = "TEST-WORKFLOW";
      const position = Position.from("PHASE_1:STAGE_1:STATUS_1");

      const kase = Case.new({
        caseRef,
        workflowCode,
        position,
        payload: {},
        phases: [],
      });

      expect(kase.timeline).toHaveLength(1);
      expect(kase.timeline[0].eventType).toBe(
        EventEnums.eventTypes.CASE_CREATED,
      );
      expect(kase.timeline[0].createdBy).toBe("System");
      expect(kase.timeline[0].data.caseRef).toBe(caseRef);
    });

    it("sets dateReceived to current timestamp", () => {
      const mockDate = new Date("2025-06-15T10:30:00.000Z");
      vi.setSystemTime(mockDate);

      const kase = Case.new({
        caseRef: "NEW-CASE-003",
        workflowCode: "TEST-WORKFLOW",
        position: Position.from("PHASE_1:STAGE_1:STATUS_1"),
        payload: {},
        phases: [],
      });

      expect(kase.dateReceived).toBe("2025-06-15T10:30:00.000Z");
    });

    it("initializes supplementaryData as empty object", () => {
      const kase = Case.new({
        caseRef: "NEW-CASE-004",
        workflowCode: "TEST-WORKFLOW",
        position: Position.from("PHASE_1:STAGE_1:STATUS_1"),
        payload: {},
        phases: [],
      });

      expect(kase.supplementaryData).toEqual({});
    });
  });

  describe("updateStageOutcome - action not found", () => {
    it("throws error when action is not found for position", () => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();

      kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
      kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      const newPosition = Position.from("PHASE_1:STAGE_1:STATUS_2");
      vi.spyOn(workflow, "getNextPosition").mockReturnValue(newPosition);

      const workflowStage = workflow.getStage(kase.position);
      vi.spyOn(workflowStage, "getActionByCode").mockReturnValue(null);

      expect(() => {
        kase.updateStageOutcome({
          workflow,
          actionCode: "NONEXISTENT_ACTION",
          comment: "Should fail",
          createdBy: validUserId,
        });
      }).toThrow(
        "Action with code NONEXISTENT_ACTION not found for position PHASE_1:STAGE_1:STATUS_1",
      );
    });
  });
});
