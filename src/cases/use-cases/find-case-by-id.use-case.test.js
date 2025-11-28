import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { Case } from "../models/case.js";
import { Comment } from "../models/comment.js";
import { EventEnums } from "../models/event-enums.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { Workflow } from "../models/workflow.js";
import { findById } from "../repositories/case.repository.js";
import {
  findCaseByIdUseCase,
  formatTimelineItemDescription,
  mapDescription,
  mapWorkflowCommentDef,
} from "./find-case-by-id.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../../users/repositories/user.repository.js");
vi.mock("../repositories/case.repository.js");
vi.mock("./find-workflow-by-code.use-case.js");

describe("formatTimelineItemDescription", () => {
  it("formats task completed", () => {
    const wf = Workflow.createMock();
    const timelineItem = {
      eventType: EventEnums.eventTypes.TASK_COMPLETED,
      createdAt: "2025-01-01T00:00:00.000Z",
      description: "Task Completed",
      createdBy: "System",
      data: {
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
      },
    };

    expect(formatTimelineItemDescription(timelineItem, wf)).toBe(
      "Task 'Task 1' completed",
    );
  });

  it("formats task updated", () => {
    const wf = Workflow.createMock();
    const timelineItem = {
      eventType: EventEnums.eventTypes.TASK_UPDATED,
      createdAt: "2025-01-01T00:00:00.000Z",
      description: "Task Updated",
      createdBy: "System",
      data: {
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
      },
    };

    expect(formatTimelineItemDescription(timelineItem, wf)).toBe(
      "Task 'Task 1' updated",
    );
  });

  it("formats stage completed", () => {
    const wf = Workflow.createMock();
    const timelineItem = {
      eventType: EventEnums.eventTypes.STAGE_COMPLETED,
      createdAt: "2025-01-01T00:00:00.000Z",
      description: "Stage Completed",
      createdBy: "System",
      data: {
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "STATUS_1",
        actionCode: "ACTION_1",
      },
    };

    expect(formatTimelineItemDescription(timelineItem, wf)).toBe(
      "Stage 'Stage 1' outcome (Action 1)",
    );
  });

  it("returns description if set", () => {
    const wf = Workflow.createMock();
    const timelineItem = {
      eventType: EventEnums.eventTypes.CASE_ASSIGNED,
      createdAt: "2025-01-01T00:00:00.000Z",
      description: "description was set",
      createdBy: "System",
      data: {},
    };

    expect(formatTimelineItemDescription(timelineItem, wf)).toBe(
      "description was set",
    );
  });

  it("builds description if not set", () => {
    const wf = Workflow.createMock();
    const timelineItem = {
      eventType: EventEnums.eventTypes.CASE_ASSIGNED,
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: "System",
      data: {},
    };

    expect(formatTimelineItemDescription(timelineItem, wf)).toBe(
      EventEnums.eventDescriptions[EventEnums.eventTypes.CASE_ASSIGNED],
    );
  });
});

describe("mapDescription", () => {
  it("converts string description to heading component array", async () => {
    const result = await mapDescription(
      {
        name: "Review Task",
        description: "Simple review task",
      },
      {},
    );
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Simple review task" },
    ]);
  });

  it("falls back to task name for empty string", async () => {
    const result = await mapDescription(
      {
        name: "Review Task",
        description: "",
      },
      {},
    );
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Review Task" },
    ]);
  });

  it("returns array description as-is when already an array", async () => {
    const input = [
      { component: "heading", level: 2, text: "Title" },
      { component: "paragraph", text: "Description" },
    ];
    const result = await mapDescription(
      {
        name: "Review Task",
        description: input,
      },
      {},
    );
    expect(result).toEqual(input);
  });

  it("resolves JSON paths in description arrays", async () => {
    const input = [{ component: "heading", level: 2, text: "$.title" }];
    const result = await mapDescription(
      {
        name: "Review Task",
        description: input,
      },
      { title: "Test Title Resolves" },
    );
    expect(result).toEqual([
      {
        component: "heading",
        level: 2,
        text: "Test Title Resolves",
      },
    ]);
  });

  it("returns heading with task name for null description", async () => {
    const result = await mapDescription(
      {
        name: "Review Application",
        description: null,
      },
      {},
    );
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Review Application" },
    ]);
  });

  it("returns heading with task name for undefined description", async () => {
    const result = await mapDescription(
      {
        name: "Check Details",
        description: undefined,
      },
      {},
    );
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Check Details" },
    ]);
  });

  it("uses default name 'Task' when name not provided and description is null", async () => {
    const result = await mapDescription({ description: null }, {});
    expect(result).toEqual([{ component: "heading", level: 2, text: "Task" }]);
  });

  it("uses default name 'Task' when name not provided and description is undefined", async () => {
    const result = await mapDescription({ description: undefined }, {});
    expect(result).toEqual([{ component: "heading", level: 2, text: "Task" }]);
  });

  it("returns heading with task name for object description", async () => {
    const result = await mapDescription(
      {
        name: "Verify Data",
        description: { foo: "bar" },
      },
      {},
    );
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Verify Data" },
    ]);
  });

  it("returns heading with task name for number description", async () => {
    const result = await mapDescription(
      {
        name: "Process Item",
        description: 123,
      },
      {},
    );
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Process Item" },
    ]);
  });

  it("falls back to task name for empty array", async () => {
    const result = await mapDescription(
      {
        name: "Review Task",
        description: [],
      },
      {},
    );
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Review Task" },
    ]);
  });

  it("falls back to task name for whitespace-only string", async () => {
    const result = await mapDescription(
      {
        name: "Process Data",
        description: "   ",
      },
      {},
    );
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Process Data" },
    ]);
  });
});

describe("findCaseByIdUseCase", () => {
  const authenticatedUserId = new ObjectId().toHexString();
  const mockAuthUser = {
    id: authenticatedUserId,
    idpId: new ObjectId().toHexString(),
    name: "Test User",
    email: "test.user@example.com",
    idpRoles: ["user"],
    appRoles: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("finds case by id", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const kase = Case.createMock({ _id: "test-case-id" });

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(kase);

    const result = await findCaseByIdUseCase("test-case-id", mockAuthUser);

    expect(findById).toHaveBeenCalledWith("test-case-id");
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(kase.workflowCode);

    // TODO: strip to what's necessary when individual endpoints are exposed
    expect(result).toEqual({
      _id: kase._id,
      assignedUser: null,
      caseRef: "case-ref",
      comments: [],
      currentStatus: "STATUS_1",
      workflowCode: "workflow-code",
      dateReceived: "2025-01-01T00:00:00.000Z",
      payload: {},
      supplementaryData: {},
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
      banner: {
        callToAction: [
          {
            code: "RECALCULATE_RULES",
            name: "Run calculations again",
          },
        ],
        summary: {
          clientReference: {
            label: "Client Reference",
            text: "case-ref",
            type: "string",
          },
        },
        title: {
          text: "",
          type: "string",
        },
      },
      links: [
        {
          href: `/cases/${kase._id}`,
          id: "tasks",
          text: "Tasks",
        },
        {
          href: `/cases/${kase._id}/case-details`,
          id: "case-details",
          text: "Case Details",
        },
        {
          href: `/cases/${kase._id}/notes`,
          id: "notes",
          text: "Notes",
        },
        {
          href: `/cases/${kase._id}/timeline`,
          id: "timeline",
          text: "Timeline",
        },
      ],
      stage: {
        code: "STAGE_1",
        description: "Stage 1 description",
        name: "Stage 1",
        interactive: true,
        outcome: undefined,
        actions: [],
        taskGroups: [
          {
            code: "TASK_GROUP_1",
            description: "Task group description",
            name: "Task group 1",
            tasks: [
              {
                code: "TASK_1",
                name: "Task 1",
                mandatory: true,
                status: "PENDING",
                completed: false,
                updatedAt: undefined,
                updatedBy: null,
                commentRef: undefined,
                commentInputDef: {
                  helpText: "All notes will be saved for auditing purposes",
                  label: "Note",
                  mandatory: false,
                },
                description: [
                  {
                    component: "heading",
                    level: 2,
                    text: "Task 1 description",
                  },
                ],
                requiredRoles: {
                  allOf: ["ROLE_1"],
                  anyOf: ["ROLE_2"],
                },
                statusOptions: [
                  {
                    code: "STATUS_OPTION_1",
                    completes: true,
                    name: "Status option 1",
                  },
                ],
              },
            ],
          },
        ],
      },
      timeline: [
        {
          eventType: "CASE_CREATED",
          description: "Case received",
          comment: null,
          commentRef: undefined,
          createdAt: "2025-01-01T00:00:00.000Z",
          createdBy: {
            id: "System",
            name: "System",
          },
          data: {
            caseRef: "case-ref",
          },
        },
      ],
      beforeContent: [],
    });
  });

  it("returns permitted actions when stage is complete", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const kase = Case.createMock({ _id: "test-case-id" });

    kase.phases[0].stages[0].taskGroups[0].tasks[0].status = "COMPLETE";
    kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(kase);

    const result = await findCaseByIdUseCase("test-case-id", mockAuthUser);

    expect(result.stage.actions).toEqual([
      {
        code: "ACTION_1",
        name: "Action 1",
        comment: {
          helpText: "Action help text",
          label: "Action label 1",
          mandatory: true,
        },
      },
    ]);
  });

  it("throws when case not found", async () => {
    findById.mockResolvedValue(null);

    await expect(
      findCaseByIdUseCase("non-existent-case-id", mockAuthUser),
    ).rejects.toThrow('Case with id "non-existent-case-id" not found');

    expect(findById).toHaveBeenCalledWith("non-existent-case-id");
  });

  it("finds case with assigned user and populates user name", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock({
      assignedUser: { id: mockUser.id },
    });

    const mockUserAssigned = User.createMock({
      id: "64c88faac1f56f71e1b89a33",
    });

    mockCase.timeline.unshift(
      TimelineEvent.createMock({
        eventType: EventEnums.eventTypes.CASE_ASSIGNED,
        createdAt: "2025-01-01T00:00:00.000Z",
        description: "Case assigned",
        createdBy: "64c88faac1f56f71e1b89a44",
        data: {
          assignedTo: "64c88faac1f56f71e1b89a33",
        },
      }),
    );

    findById.mockResolvedValue(mockCase);
    findAll.mockResolvedValue([mockUser, mockUserAssigned]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findAll).toHaveBeenCalledWith({
      ids: [
        mockUser.id,
        "64c88faac1f56f71e1b89a44",
        "64c88faac1f56f71e1b89a33",
      ],
    });
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(result.assignedUser.name).toBe(mockUser.name);
    expect(result.requiredRoles).toEqual(mockWorkflow.requiredRoles);
  });

  it("throws when user lookup fails for assigned user", async () => {
    const mockCase = Case.createMock({
      assignedUser: { id: "unknown-user-id-id000000000" },
    });
    const userError = new Error("User not found");
    const mockWorkflow = Workflow.createMock();

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findAll.mockRejectedValue(userError);

    await expect(
      findCaseByIdUseCase(mockCase._id, mockAuthUser),
    ).rejects.toThrow("User not found");

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(findAll).toHaveBeenCalledWith({ ids: [mockCase.assignedUser.id] });
  });

  it("finds workflow by code and assigns requiredRoles to case", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock({
      workflowCode: "TEST_WORKFLOW",
    });

    findById.mockResolvedValue(mockCase);
    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("TEST_WORKFLOW");
    expect(result.requiredRoles).toEqual({
      allOf: ["ROLE_1", "ROLE_2"],
      anyOf: ["ROLE_3"],
    });
  });

  it("finds case with both assigned user and workflow", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock({
      assignedUser: { id: mockUser.id },
      workflowCode: "USER_WORKFLOW",
    });

    findById.mockResolvedValue(mockCase);
    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findAll).toHaveBeenCalledWith({ ids: [mockUser.id] });
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("USER_WORKFLOW");
    expect(result.assignedUser.name).toBe(mockUser.name);
    expect(result.requiredRoles).toEqual({
      allOf: ["ROLE_1", "ROLE_2"],
      anyOf: ["ROLE_3"],
    });
  });

  it("throws when workflow lookup fails", async () => {
    const mockUser = User.createMock();
    const mockCase = Case.createMock({
      workflowCode: "INVALID_WORKFLOW",
    });
    const workflowError = new Error("Workflow not found");

    findById.mockResolvedValue(mockCase);
    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockRejectedValue(workflowError);

    await expect(
      findCaseByIdUseCase(mockCase._id, mockAuthUser),
    ).rejects.toThrow("Workflow not found");

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("INVALID_WORKFLOW");
  });

  it("finds case with assigned user and populates user name", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock({
      assignedUser: { id: mockUser.id },
    });

    findById.mockResolvedValue(mockCase);
    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(result.assignedUser).toEqual({
      name: mockUser.name,
    });
    expect(result.requiredRoles).toEqual(mockWorkflow.requiredRoles);
  });

  describe("stage outcome comment resolution", () => {
    it("resolves outcome comment text when outcome and comment exist", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      // Create a case with stage outcome that references a comment
      const commentRef = "64c88faac1f56f71e1b89a33";
      const mockCase = Case.createMock();

      mockCase.comments = [
        new Comment({
          ref: commentRef,
          type: "STAGE_COMPLETED",
          text: "Application approved with conditions",
          createdBy: mockUser.id,
          createdAt: "2025-01-01T12:00:00.000Z",
        }),
      ];

      mockCase.getStage().outcome = {
        actionCode: "APPROVE",
        commentRef,
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
      };

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.stage.outcome).toEqual({
        actionCode: "APPROVE",
        commentRef,
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
        comment: "Application approved with conditions",
      });
    });

    it("handles outcome with no comment reference", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      const mockCase = Case.createMock();

      mockCase.getStage().outcome = {
        actionCode: "APPROVE",
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
        comment: undefined,
      };

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.stage.outcome).toEqual({
        actionCode: "APPROVE",
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
        comment: undefined,
      });
    });

    it("handles outcome with comment reference that doesn't exist", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      const mockCase = Case.createMock();

      mockCase.getStage().outcome = {
        actionCode: "APPROVE",
        commentRef: "64c88faac1f56f71e1b89a34",
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
        comment: undefined,
      };

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.stage.outcome).toEqual({
        actionCode: "APPROVE",
        commentRef: "64c88faac1f56f71e1b89a34",
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
        comment: undefined,
      });
    });

    it("handles stage with no outcome", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      const mockCase = Case.createMock();

      mockCase.getStage().outcome = undefined;

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.stage.outcome).toBeUndefined();
    });
  });
});

describe("mapWorkflowCommentDef", () => {
  it("returns default comment when workflowTask has no comment", () => {
    const workflowTask = {
      code: "TASK_1",
      name: "Review Task",
    };

    const result = mapWorkflowCommentDef(workflowTask);

    expect(result).toEqual({
      label: "Note",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });

  it("merges workflow task comment with default values", () => {
    const workflowTask = {
      code: "TASK_1",
      name: "Review Task",
      comment: {
        label: "Approval Note",
        helpText: "Provide reason for approval",
        mandatory: true,
      },
    };

    const result = mapWorkflowCommentDef(workflowTask);

    expect(result).toEqual({
      label: "Approval Note",
      helpText: "Provide reason for approval",
      mandatory: true,
    });
  });

  it("returns default comment when workflowTask is null", () => {
    const result = mapWorkflowCommentDef(null);

    expect(result).toEqual({
      label: "Note",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });

  it("returns default comment when workflowTask is undefined", () => {
    const result = mapWorkflowCommentDef(undefined);

    expect(result).toEqual({
      label: "Note",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });

  it("merges partial workflow task comment with defaults", () => {
    const workflowTask = {
      code: "TASK_1",
      name: "Review Task",
      comment: {
        label: "Custom Label",
      },
    };

    const result = mapWorkflowCommentDef(workflowTask);

    expect(result).toEqual({
      label: "Custom Label",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });

  it("preserves all fields from workflow task comment", () => {
    const workflowTask = {
      code: "TASK_1",
      name: "Review Task",
      comment: {
        label: "Rejection Reason",
        helpText: "Explain why this was rejected",
        mandatory: true,
      },
    };

    const result = mapWorkflowCommentDef(workflowTask);

    expect(result).toEqual({
      label: "Rejection Reason",
      helpText: "Explain why this was rejected",
      mandatory: true,
    });
  });

  it("handles workflowTask with empty comment object", () => {
    const workflowTask = {
      code: "TASK_1",
      name: "Review Task",
      comment: {},
    };

    const result = mapWorkflowCommentDef(workflowTask);

    expect(result).toEqual({
      label: "Note",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });
});

describe("beforeContent", () => {
  const authenticatedUserId = new ObjectId().toHexString();
  const mockAuthUser = {
    id: authenticatedUserId,
    idpId: new ObjectId().toHexString(),
    name: "Test User",
    email: "test.user@example.com",
    idpRoles: ["user"],
  };

  it("returns empty array when stage has no beforeContent", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock();

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(mockCase);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

    expect(result.beforeContent).toEqual([]);
  });

  it("processes beforeContent with truthy renderIf condition", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock();

    const stageWithBeforeContent = mockWorkflow.phases[0].stages[0];
    stageWithBeforeContent.beforeContent = [
      {
        renderIf: "jsonata:$.request.params.tabId = 'task-list'",
        content: [
          {
            component: "heading",
            text: "This is before content",
            level: 2,
          },
        ],
      },
    ];

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(mockCase);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser, {
      params: { tabId: "task-list" },
    });

    expect(result.beforeContent).toEqual([
      {
        component: "heading",
        text: "This is before content",
        level: 2,
      },
    ]);
  });

  it("filters out beforeContent with falsy renderIf condition", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock();

    const stageWithBeforeContent = mockWorkflow.phases[0].stages[0];
    stageWithBeforeContent.beforeContent = [
      {
        renderIf: "jsonata:$.request.params.tabId = 'task-list'",
        content: [
          {
            component: "heading",
            text: "This should not appear",
            level: 2,
          },
        ],
      },
    ];

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(mockCase);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser, {
      params: { tabId: "case-details" },
    });

    expect(result.beforeContent).toEqual([]);
  });

  it("processes multiple beforeContent items", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock();

    const stageWithBeforeContent = mockWorkflow.phases[0].stages[0];
    stageWithBeforeContent.beforeContent = [
      {
        renderIf: "jsonata:$.request.params.tabId = 'task-list'",
        content: [
          {
            component: "heading",
            text: "First heading",
            level: 2,
          },
        ],
      },
      {
        renderIf: "jsonata:$.request.params.tabId = 'task-list'",
        content: [
          {
            component: "text",
            text: "Second text",
          },
        ],
      },
    ];

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(mockCase);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser, {
      params: { tabId: "task-list" },
    });

    expect(result.beforeContent).toEqual([
      {
        component: "heading",
        text: "First heading",
        level: 2,
      },
      {
        component: "text",
        text: "Second text",
      },
    ]);
  });

  it("processes beforeContent without renderIf (always included)", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock();

    const stageWithBeforeContent = mockWorkflow.phases[0].stages[0];
    stageWithBeforeContent.beforeContent = [
      {
        content: [
          {
            component: "heading",
            text: "Always visible content",
            level: 2,
          },
        ],
      },
    ];

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(mockCase);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser, {
      params: { tabId: "any-tab" },
    });

    expect(result.beforeContent).toEqual([
      {
        component: "heading",
        text: "Always visible content",
        level: 2,
      },
    ]);
  });

  it("resolves JSONPath references in beforeContent", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock();
    mockCase.caseRef = "TEST-REF-123";

    const stageWithBeforeContent = mockWorkflow.phases[0].stages[0];
    stageWithBeforeContent.beforeContent = [
      {
        renderIf: "jsonata:$.request.params.tabId = 'task-list'",
        content: [
          {
            component: "heading",
            text: "$.caseRef",
            level: 2,
          },
        ],
      },
    ];

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(mockCase);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser, {
      params: { tabId: "task-list" },
    });

    expect(result.beforeContent).toEqual([
      {
        component: "heading",
        text: "TEST-REF-123",
        level: 2,
      },
    ]);
  });
});
