import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { Case } from "../models/case.js";
import { EventEnums } from "../models/event-enums.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { Workflow } from "../models/workflow.js";
import { findById } from "../repositories/case.repository.js";
import {
  findCaseByIdUseCase,
  formatTimelineItemDescription,
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
        stageCode: "stage-1",
        taskGroupCode: "stage-1-tasks",
        taskCode: "task-1",
      },
    };

    expect(formatTimelineItemDescription(timelineItem, wf)).toBe(
      "Task 'Task 1' completed",
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
        stageCode: "stage-1",
        actionId: "reject",
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
        stages: [
          {
            code: "stage-1",
            taskGroups: [],
            outcome: {
              actionId: "approve",
              commentRef,
              createdBy: mockUser.id,
              createdAt: "2025-01-01T12:00:00.000Z",
            },
          },
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

      expect(result.stages[0].outcome).toEqual({
        actionId: "approve",
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
        stages: [
          {
            code: "stage-1",
            taskGroups: [],
            outcome: {
              actionId: "approve",
              createdBy: mockUser.id,
              createdAt: "2025-01-01T12:00:00.000Z",
            },
          },
        ],
      });

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.stages[0].outcome).toEqual({
        actionId: "approve",
        createdBy: mockUser.id,
        createdAt: "2025-01-01T12:00:00.000Z",
        comment: undefined,
      });
    });

    it("handles outcome with comment reference that doesn't exist", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      const mockCase = Case.createMock({
        stages: [
          {
            code: "stage-1",
            taskGroups: [],
            outcome: {
              actionId: "approve",
              commentRef: "64c88faac1f56f71e1b89a34",
              createdBy: mockUser.id,
              createdAt: "2025-01-01T12:00:00.000Z",
            },
          },
        ],
        comments: [],
      });

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.stages[0].outcome).toEqual({
        actionId: "approve",
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
        stages: [
          {
            code: "stage-1",
            taskGroups: [],
          },
        ],
      });

      findAll.mockResolvedValue([mockUser]);
      findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
      findById.mockResolvedValue(mockCase);

      const result = await findCaseByIdUseCase(mockCase._id, mockAuthUser);

      expect(result.stages[0].outcome).toBeUndefined();
    });

    it("handles multiple stages with different outcome scenarios", async () => {
      const mockUser = User.createMock();
      const mockWorkflow = Workflow.createMock();

      const commentRef1 = "64c88faac1f56f71e1b89a35";
      const commentRef2 = "64c88faac1f56f71e1b89a36";

      const mockCase = Case.createMock({
        stages: [
          {
            code: "stage-1",
            taskGroups: [],
            outcome: {
              actionId: "approve",
              commentRef: commentRef1,
              createdBy: mockUser.id,
              createdAt: "2025-01-01T12:00:00.000Z",
            },
          },
          {
            code: "stage-2",
            taskGroups: [],
          },
          {
            code: "stage-3",
            taskGroups: [],
            outcome: {
              actionId: "reject",
              commentRef: commentRef2,
              createdBy: mockUser.id,
              createdAt: "2025-01-01T13:00:00.000Z",
            },
          },
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

      expect(result.stages[0].outcome.comment).toBe("First stage approved");
      expect(result.stages[1].outcome).toBeUndefined();
      expect(result.stages[2].outcome.comment).toBe(
        "Application rejected due to incomplete information",
      );
    });
  });
});
