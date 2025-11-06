import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { CasePhase } from "../models/case-phase.js";
import { CaseStage } from "../models/case-stage.js";
import { Case } from "../models/case.js";
import { EventEnums } from "../models/event-enums.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { Workflow } from "../models/workflow.js";
import { findById } from "../repositories/case.repository.js";
import {
  findCaseByIdUseCase,
  formatTimelineItemDescription,
  mapDescription,
  mapWorkflowComment,
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
        phaseCode: "phase-1",
        stageCode: "stage-1",
        taskGroupCode: "task-group-1",
        taskCode: "task-1",
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
        phaseCode: "phase-1",
        stageCode: "stage-1",
        taskGroupCode: "task-group-1",
        taskCode: "task-1",
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
        phaseCode: "phase-1",
        stageCode: "stage-1",
        actionCode: "reject",
      },
    };

    expect(formatTimelineItemDescription(timelineItem, wf)).toBe(
      "Stage 'Stage 1' outcome (reject)",
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
  it("converts string description to heading component array", () => {
    const result = mapDescription({
      name: "Review Task",
      description: "Simple review task",
    });
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Simple review task" },
    ]);
  });

  it("falls back to task name for empty string", () => {
    const result = mapDescription({
      name: "Review Task",
      description: "",
    });
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Review Task" },
    ]);
  });

  it("returns array description as-is when already an array", () => {
    const input = [
      { component: "heading", level: 2, text: "Title" },
      { component: "paragraph", text: "Description" },
    ];
    const result = mapDescription({
      name: "Review Task",
      description: input,
    });
    expect(result).toEqual(input);
  });

  it("returns heading with task name for null description", () => {
    const result = mapDescription({
      name: "Review Application",
      description: null,
    });
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Review Application" },
    ]);
  });

  it("returns heading with task name for undefined description", () => {
    const result = mapDescription({
      name: "Check Details",
      description: undefined,
    });
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Check Details" },
    ]);
  });

  it("uses default name 'Task' when name not provided and description is null", () => {
    const result = mapDescription({ description: null });
    expect(result).toEqual([{ component: "heading", level: 2, text: "Task" }]);
  });

  it("uses default name 'Task' when name not provided and description is undefined", () => {
    const result = mapDescription({ description: undefined });
    expect(result).toEqual([{ component: "heading", level: 2, text: "Task" }]);
  });

  it("returns heading with task name for object description", () => {
    const result = mapDescription({
      name: "Verify Data",
      description: { foo: "bar" },
    });
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Verify Data" },
    ]);
  });

  it("returns heading with task name for number description", () => {
    const result = mapDescription({
      name: "Process Item",
      description: 123,
    });
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Process Item" },
    ]);
  });

  it("falls back to task name for empty array", () => {
    const result = mapDescription({
      name: "Review Task",
      description: [],
    });
    expect(result).toEqual([
      { component: "heading", level: 2, text: "Review Task" },
    ]);
  });

  it("falls back to task name for whitespace-only string", () => {
    const result = mapDescription({
      name: "Process Data",
      description: "   ",
    });
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
    expect(result.requiredRoles).toEqual(mockWorkflow.requiredRoles);

    const [stage] = result.phases[0].stages;

    expect(stage.name).toEqual("Stage 1");
    expect(stage.description).toEqual("Stage 1 description");

    const [taskGroup] = stage.taskGroups;

    expect(taskGroup.name).toEqual("Task group 1");
    expect(taskGroup.description).toEqual("Task group description");

    const [task] = taskGroup.tasks;

    expect(task.name).toEqual("Task 1");
    expect(task.description).toEqual([
      { component: "heading", level: 2, text: "Task 1 description" },
    ]);

    expect(result).toBe(kase);
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
    expect(result).toBe(mockCase);
  });

  it("throws when user lookup fails for assigned user", async () => {
    const mockCase = Case.createMock({
      assignedUser: { id: "unknown-user-id-id000000000" },
    });
    const userError = new Error("User not found");

    findById.mockResolvedValue(mockCase);
    findAll.mockRejectedValue(userError);

    await expect(
      findCaseByIdUseCase(mockCase._id, mockAuthUser),
    ).rejects.toThrow("User not found");

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findAll).toHaveBeenCalledWith({ ids: [mockCase.assignedUser.id] });
  });

  it("finds workflow by code and assigns requiredRoles to case", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock({
      requiredRoles: ["ROLE_A", "ROLE_B"],
    });
    const mockCase = Case.createMock({
      workflowCode: "TEST_WORKFLOW",
    });

    findById.mockResolvedValue(mockCase);
    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("TEST_WORKFLOW");
    expect(result.requiredRoles).toEqual(["ROLE_A", "ROLE_B"]);
    expect(result).toBe(mockCase);
  });

  it("finds case with both assigned user and workflow", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock({
      requiredRoles: ["USER_ROLE"],
    });
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
    expect(result.requiredRoles).toEqual(["USER_ROLE"]);
    expect(result).toBe(mockCase);
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
    expect(result.assignedUser.name).toBe(mockUser.name);
    expect(result.requiredRoles).toEqual(mockWorkflow.requiredRoles);
    expect(result).toBe(mockCase);
  });

  describe("stage outcome comment resolution", () => {
    it("resolves outcome comment text when outcome and comment exist", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      // Create a case with stage outcome that references a comment
      const commentRef = "64c88faac1f56f71e1b89a33";
      const mockCase = Case.createMock({
        phases: [
          new CasePhase({
            code: "phase-1",
            stages: [
              new CaseStage({
                code: "stage-1",
                taskGroups: [],
                outcome: {
                  actionCode: "approve",
                  commentRef,
                  createdBy: mockUser.id,
                  createdAt: "2025-01-01T12:00:00.000Z",
                },
              }),
            ],
          }),
        ],
        comments: [
          {
            ref: commentRef,
            type: "STAGE_COMPLETED",
            text: "Application approved with conditions",
            createdBy: mockUser.id,
            createdAt: "2025-01-01T12:00:00.000Z",
          },
        ],
      });

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.phases[0].stages[0].outcome).toEqual({
        actionCode: "approve",
        commentRef,
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
        comment: "Application approved with conditions",
      });
    });

    it("handles outcome with no comment reference", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      const mockCase = Case.createMock({
        phases: [
          new CasePhase({
            code: "phase-1",
            stages: [
              new CaseStage({
                code: "stage-1",
                taskGroups: [],
                outcome: {
                  actionCode: "approve",
                  createdBy: mockUser.id,
                  createdAt: "2025-01-01T12:00:00.000Z",
                },
              }),
            ],
          }),
        ],
      });

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.phases[0].stages[0].outcome).toEqual({
        actionCode: "approve",
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
        comment: undefined,
      });
    });

    it("handles outcome with comment reference that doesn't exist", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      const mockCase = Case.createMock({
        phases: [
          new CasePhase({
            code: "phase-1",
            stages: [
              new CaseStage({
                code: "stage-1",
                taskGroups: [],
                outcome: {
                  actionCode: "approve",
                  commentRef: "64c88faac1f56f71e1b89a34",
                  createdBy: mockUser.id,
                  createdAt: "2025-01-01T12:00:00.000Z",
                },
              }),
            ],
          }),
        ],
        comments: [],
      });

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.phases[0].stages[0].outcome).toEqual({
        actionCode: "approve",
        commentRef: "64c88faac1f56f71e1b89a34",
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
        comment: undefined,
      });
    });

    it("handles stage with no outcome", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      const mockCase = Case.createMock({
        phases: [
          new CasePhase({
            code: "phase-1",
            stages: [
              new CaseStage({
                code: "stage-1",
                taskGroups: [],
              }),
            ],
          }),
        ],
      });

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.phases[0].stages[0].outcome).toBeUndefined();
    });

    it("handles multiple stages with different outcome scenarios", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      const commentRef1 = "64c88faac1f56f71e1b89a35";
      const commentRef2 = "64c88faac1f56f71e1b89a36";

      const mockCase = Case.createMock({
        phases: [
          new CasePhase({
            code: "phase-1",
            stages: [
              new CaseStage({
                code: "stage-1",
                taskGroups: [],
                outcome: {
                  actionCode: "approve",
                  commentRef: commentRef1,
                  createdBy: mockUser.id,
                  createdAt: "2025-01-01T12:00:00.000Z",
                },
              }),
              new CaseStage({
                code: "stage-2",
                taskGroups: [],
              }),
              new CaseStage({
                code: "stage-3",
                taskGroups: [],
                outcome: {
                  actionCode: "reject",
                  commentRef: commentRef2,
                  createdBy: mockUser.id,
                  createdAt: "2025-01-01T13:00:00.000Z",
                },
              }),
            ],
          }),
        ],
        comments: [
          {
            ref: commentRef1,
            type: "STAGE_COMPLETED",
            text: "First stage approved",
            createdBy: mockUser.id,
            createdAt: "2025-01-01T12:00:00.000Z",
          },
          {
            ref: commentRef2,
            type: "STAGE_COMPLETED",
            text: "Application rejected due to incomplete information",
            createdBy: mockUser.id,
            createdAt: "2025-01-01T13:00:00.000Z",
          },
        ],
      });

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.phases[0].stages[0].outcome.comment).toBe(
        "First stage approved",
      );
      expect(result.phases[0].stages[1].outcome).toBeUndefined();
      expect(result.phases[0].stages[2].outcome.comment).toBe(
        "Application rejected due to incomplete information",
      );
    });
  });
});

describe("mapWorkflowComment", () => {
  it("returns default comment when workflowTask has no comment", () => {
    const workflowTask = {
      code: "task-1",
      name: "Review Task",
    };

    const result = mapWorkflowComment(workflowTask);

    expect(result).toEqual({
      label: "Note",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });

  it("merges workflow task comment with default values", () => {
    const workflowTask = {
      code: "task-1",
      name: "Review Task",
      comment: {
        label: "Approval Note",
        helpText: "Provide reason for approval",
        mandatory: true,
      },
    };

    const result = mapWorkflowComment(workflowTask);

    expect(result).toEqual({
      label: "Approval Note",
      helpText: "Provide reason for approval",
      mandatory: true,
    });
  });

  it("returns default comment when workflowTask is null", () => {
    const result = mapWorkflowComment(null);

    expect(result).toEqual({
      label: "Note",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });

  it("returns default comment when workflowTask is undefined", () => {
    const result = mapWorkflowComment(undefined);

    expect(result).toEqual({
      label: "Note",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });

  it("merges partial workflow task comment with defaults", () => {
    const workflowTask = {
      code: "task-1",
      name: "Review Task",
      comment: {
        label: "Custom Label",
      },
    };

    const result = mapWorkflowComment(workflowTask);

    expect(result).toEqual({
      label: "Custom Label",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });

  it("preserves all fields from workflow task comment", () => {
    const workflowTask = {
      code: "task-1",
      name: "Review Task",
      comment: {
        label: "Rejection Reason",
        helpText: "Explain why this was rejected",
        mandatory: true,
      },
    };

    const result = mapWorkflowComment(workflowTask);

    expect(result).toEqual({
      label: "Rejection Reason",
      helpText: "Explain why this was rejected",
      mandatory: true,
    });
  });

  it("handles workflowTask with empty comment object", () => {
    const workflowTask = {
      code: "task-1",
      name: "Review Task",
      comment: {},
    };

    const result = mapWorkflowComment(workflowTask);

    expect(result).toEqual({
      label: "Note",
      helpText: "All notes will be saved for auditing purposes",
      mandatory: false,
    });
  });
});
