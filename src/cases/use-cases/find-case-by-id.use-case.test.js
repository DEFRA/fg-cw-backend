import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findAll } from "../../users/repositories/user.repository.js";
import { Case } from "../models/case.js";
import { EventEnums } from "../models/event-enums.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { Workflow } from "../models/workflow.js";
import { findById } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../../users/repositories/user.repository.js");
vi.mock("../repositories/case.repository.js");
vi.mock("./find-workflow-by-code.use-case.js");

describe("findCaseByIdUseCase", () => {
  it("finds case by id", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const kase = Case.createMock({ _id: "test-case-id" });

    findAll.mockResolvedValue([mockUser]);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findById.mockResolvedValue(kase);

    const result = await findCaseByIdUseCase("test-case-id");

    expect(findById).toHaveBeenCalledWith("test-case-id");
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(kase.workflowCode);
    expect(result.requiredRoles).toEqual(mockWorkflow.requiredRoles);
    expect(result).toBe(kase);
  });

  it("throws when case not found", async () => {
    findById.mockResolvedValue(null);

    await expect(findCaseByIdUseCase("non-existent-case-id")).rejects.toThrow(
      'Case with id "non-existent-case-id" not found',
    );

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

    const result = await findCaseByIdUseCase(mockCase._id);

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

    await expect(findCaseByIdUseCase(mockCase._id)).rejects.toThrow(
      "User not found",
    );

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

    const result = await findCaseByIdUseCase(mockCase._id);

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

    const result = await findCaseByIdUseCase(mockCase._id);

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

    await expect(findCaseByIdUseCase(mockCase._id)).rejects.toThrow(
      "Workflow not found",
    );

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

    const result = await findCaseByIdUseCase(mockCase._id);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(result.assignedUser.name).toBe(mockUser.name);
    expect(result.requiredRoles).toEqual(mockWorkflow.requiredRoles);
    expect(result).toBe(mockCase);
  });
});
