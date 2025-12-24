import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { AppRole } from "../../users/models/app-role.js";
import { User } from "../../users/models/user.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { Case } from "../models/case.js";
import { Comment } from "../models/comment.js";
import { EventEnums } from "../models/event-enums.js";
import { RequiredAppRoles } from "../models/required-app-roles.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { Workflow } from "../models/workflow.js";
import { findById } from "../repositories/case.repository.js";
import {
  findCaseByIdUseCase,
  formatTimelineItemDescription,
  mapDescription,
  mapSelectedStatusOption,
  mapStatusOptions,
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
  const mockAuthUser = User.createMock({
    id: authenticatedUserId,
    idpId: new ObjectId().toHexString(),
    name: "Test User",
    email: "test.user@example.com",
    idpRoles: ["user"],
    appRoles: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

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
          text: "Application",
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
                  helpText:
                    "You must include an explanation for auditing purposes.",
                  label: "Explain this outcome",
                  mandatory: true,
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
                canComplete: false,
                statusOptions: [
                  {
                    code: "STATUS_OPTION_1",
                    completes: true,
                    name: "Status option 1",
                    theme: "SUCCESS",
                  },
                ],
                statusText: "Incomplete",
                statusTheme: "INFO",
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

  it("sets canComplete to true when task has no required roles", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const kase = Case.createMock({ _id: "test-case-id" });

    // Set task requiredRoles to have empty arrays (simulating null in database)
    mockWorkflow.phases[0].stages[0].taskGroups[0].tasks[0].requiredRoles =
      new RequiredAppRoles({
        allOf: [],
        anyOf: [],
      });

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(kase);

    const result = await findCaseByIdUseCase("test-case-id", mockAuthUser);

    const task = result.stage.taskGroups[0].tasks[0];
    expect(task.requiredRoles).toEqual({
      allOf: [],
      anyOf: [],
    });
    expect(task.canComplete).toBe(true);
  });

  it("sets canComplete to false when user lacks required roles", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const kase = Case.createMock({ _id: "test-case-id" });

    mockWorkflow.phases[0].stages[0].taskGroups[0].tasks[0].requiredRoles =
      new RequiredAppRoles({
        allOf: ["ROLE_RPA_ADMIN"],
        anyOf: [],
      });

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(kase);

    const result = await findCaseByIdUseCase("test-case-id", mockAuthUser);

    const task = result.stage.taskGroups[0].tasks[0];
    expect(task.canComplete).toBe(false);
  });

  it("sets canComplete to true when user has required roles", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const kase = Case.createMock({ _id: "test-case-id" });

    const authenticatedUserWithRoles = User.createMock({
      id: mockAuthUser.id,
      idpId: mockAuthUser.idpId,
      name: mockAuthUser.name,
      email: mockAuthUser.email,
      idpRoles: mockAuthUser.idpRoles,
      appRoles: {
        ROLE_RPA_ADMIN: new AppRole({
          name: "ROLE_RPA_ADMIN",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
      },
      createdAt: mockAuthUser.createdAt,
      updatedAt: mockAuthUser.updatedAt,
    });

    mockWorkflow.phases[0].stages[0].taskGroups[0].tasks[0].requiredRoles =
      new RequiredAppRoles({
        allOf: ["ROLE_RPA_ADMIN"],
        anyOf: [],
      });

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(kase);

    const result = await findCaseByIdUseCase(
      "test-case-id",
      authenticatedUserWithRoles,
    );

    const task = result.stage.taskGroups[0].tasks[0];
    expect(task.canComplete).toBe(true);
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

    it("maps statusText using altName when present and transforms statusOptions", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockCase = Case.createMock();

      // Set a task status
      mockCase.phases[0].stages[0].taskGroups[0].tasks[0].status =
        "STATUS_OPTION_1";
      mockCase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;

      // Add theme and altName to workflow status option
      mockWorkflow.phases[0].stages[0].taskGroups[0].tasks[0].statusOptions = [
        {
          code: "STATUS_OPTION_1",
          name: "Accepted",
          theme: "NONE",
          altName: "Accept",
          completes: true,
        },
        {
          code: "STATUS_OPTION_2",
          name: "Information requested",
          theme: "NOTICE",
          altName: "Request information from customer",
          completes: false,
        },
      ];

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      const task = result.stage.taskGroups[0].tasks[0];
      expect(task.status).toBe("STATUS_OPTION_1");
      expect(task.statusText).toBe("Accepted");
      expect(task.statusTheme).toBe("NONE");

      // Verify statusOptions are transformed
      expect(task.statusOptions).toEqual([
        {
          code: "STATUS_OPTION_1",
          name: "Accept",
          theme: "NONE",
          completes: true,
        },
        {
          code: "STATUS_OPTION_2",
          name: "Request information from customer",
          theme: "NOTICE",
          completes: false,
        },
      ]);
    });

    it("returns Incomplete when task has no selected status", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockCase = Case.createMock();

      // Ensure task has no status
      mockCase.phases[0].stages[0].taskGroups[0].tasks[0].status = null;
      mockCase.phases[0].stages[0].taskGroups[0].tasks[0].completed = false;

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      const task = result.stage.taskGroups[0].tasks[0];
      expect(task.status).toBeNull();
      expect(task.statusText).toBe("Incomplete");
      expect(task.statusTheme).toBe("INFO");
    });

    it("shows selected status even when task is not completed", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockCase = Case.createMock();

      // Set task with status but not completed
      mockCase.phases[0].stages[0].taskGroups[0].tasks[0].status = "RFI";
      mockCase.phases[0].stages[0].taskGroups[0].tasks[0].completed = false;

      mockWorkflow.phases[0].stages[0].taskGroups[0].tasks[0].statusOptions = [
        {
          code: "RFI",
          name: "Information requested",
          altName: "Request information from customer",
          theme: "NOTICE",
          completes: false,
        },
        {
          code: "ACCEPTED",
          name: "Accepted",
          altName: "Accept",
          theme: "NONE",
          completes: true,
        },
      ];

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      const task = result.stage.taskGroups[0].tasks[0];
      expect(task.status).toBe("RFI");
      expect(task.statusText).toBe("Information requested");
      expect(task.statusTheme).toBe("NOTICE");
      expect(task.completed).toBe(false);
    });
  });
});

describe("mapSelectedStatusOption", () => {
  it("returns name as statusText (altName is used only in statusOptions array)", () => {
    const statusOptions = [
      {
        code: "ACCEPTED",
        name: "Accepted",
        altName: "Accept",
        theme: "NONE",
        completes: true,
      },
      {
        code: "RFI",
        name: "Information requested",
        altName: "Request information from customer",
        theme: "NOTICE",
        completes: false,
      },
    ];

    const result = mapSelectedStatusOption("ACCEPTED", statusOptions);

    expect(result).toEqual({
      statusText: "Accepted",
      statusTheme: "NONE",
    });
  });

  it("returns Incomplete when status code is null", () => {
    const statusOptions = [
      {
        code: "ACCEPTED",
        name: "Accepted",
        altName: "Accept",
        theme: "NONE",
        completes: true,
      },
    ];

    const result = mapSelectedStatusOption(null, statusOptions);

    expect(result).toEqual({
      statusText: "Incomplete",
      statusTheme: "INFO",
    });
  });

  it("returns Incomplete when status code does not match any option", () => {
    const statusOptions = [
      {
        code: "ACCEPTED",
        name: "Accepted",
        altName: "Accept",
        theme: "NONE",
        completes: true,
      },
    ];

    const result = mapSelectedStatusOption("NONEXISTENT", statusOptions);

    expect(result).toEqual({
      statusText: "Incomplete",
      statusTheme: "INFO",
    });
  });

  it("falls back to name as statusText when altName is not present", () => {
    const statusOptions = [
      {
        code: "ACCEPTED",
        name: "Accepted",
        theme: "NONE",
        completes: true,
      },
    ];

    const result = mapSelectedStatusOption("ACCEPTED", statusOptions);

    expect(result).toEqual({
      statusText: "Accepted",
      statusTheme: "NONE",
    });
  });

  it("handles missing theme gracefully", () => {
    const statusOptions = [
      {
        code: "ACCEPTED",
        name: "Accepted",
        altName: "Accept",
        completes: true,
      },
    ];

    const result = mapSelectedStatusOption("ACCEPTED", statusOptions);

    expect(result).toEqual({
      statusText: "Accepted",
      statusTheme: "NONE",
    });
  });
});

describe("mapStatusOptions", () => {
  it("transforms status options using altName when present", () => {
    const statusOptions = [
      {
        code: "ACCEPTED",
        name: "Accepted",
        altName: "Accept",
        theme: "NONE",
        completes: true,
      },
      {
        code: "RFI",
        name: "Information requested",
        altName: "Request information from customer",
        theme: "NOTICE",
        completes: false,
      },
    ];

    const result = mapStatusOptions(statusOptions);

    expect(result).toEqual([
      {
        code: "ACCEPTED",
        name: "Accept",
        theme: "NONE",
        completes: true,
      },
      {
        code: "RFI",
        name: "Request information from customer",
        theme: "NOTICE",
        completes: false,
      },
    ]);
  });

  it("falls back to name when altName is missing", () => {
    const statusOptions = [
      {
        code: "COMPLETE",
        name: "Complete",
        theme: "SUCCESS",
        completes: true,
      },
    ];

    const result = mapStatusOptions(statusOptions);

    expect(result).toEqual([
      {
        code: "COMPLETE",
        name: "Complete",
        theme: "SUCCESS",
        completes: true,
      },
    ]);
  });

  it("handles empty array", () => {
    const result = mapStatusOptions([]);
    expect(result).toEqual([]);
  });

  it("handles mixed altName presence", () => {
    const statusOptions = [
      {
        code: "ACCEPTED",
        name: "Accepted",
        altName: "Accept",
        theme: "NONE",
        completes: true,
      },
      {
        code: "COMPLETE",
        name: "Complete",
        theme: "SUCCESS",
        completes: true,
      },
    ];

    const result = mapStatusOptions(statusOptions);

    expect(result).toEqual([
      {
        code: "ACCEPTED",
        name: "Accept",
        theme: "NONE",
        completes: true,
      },
      {
        code: "COMPLETE",
        name: "Complete",
        theme: "SUCCESS",
        completes: true,
      },
    ]);
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
      label: "Explain this outcome",
      helpText: "You must include an explanation for auditing purposes.",
      mandatory: true,
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
      label: "Explain this outcome",
      helpText: "You must include an explanation for auditing purposes.",
      mandatory: true,
    });
  });

  it("returns default comment when workflowTask is undefined", () => {
    const result = mapWorkflowCommentDef(undefined);

    expect(result).toEqual({
      label: "Explain this outcome",
      helpText: "You must include an explanation for auditing purposes.",
      mandatory: true,
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
      helpText: "You must include an explanation for auditing purposes.",
      mandatory: true,
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
      label: "Explain this outcome",
      helpText: "You must include an explanation for auditing purposes.",
      mandatory: true,
    });
  });
});

describe("beforeContent", () => {
  const authenticatedUserId = new ObjectId().toHexString();
  const mockAuthUser = User.createMock({
    id: authenticatedUserId,
    idpId: new ObjectId().toHexString(),
    name: "Test User",
    email: "test.user@example.com",
    idpRoles: ["user"],
    appRoles: {},
  });

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
