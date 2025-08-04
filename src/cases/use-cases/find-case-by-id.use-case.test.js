import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findById } from "../repositories/case.repository.js";
import { enrichCaseUseCase } from "./enrich-case.use-case.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../../users/use-cases/find-user-by-id.use-case.js");
vi.mock("../../users/use-cases/find-users.use-case.js");
vi.mock("./enrich-case.use-case.js");
vi.mock("./find-workflow-by-code.use-case.js");

describe("findCaseByIdUseCase", () => {
  it("finds case by id", async () => {
    const mockWorkflow = Workflow.createMock();
    const kase = Case.createMock({ _id: "test-case-id" });
    const enrichedCase = { ...kase, requiredRoles: mockWorkflow.requiredRoles };

    findById.mockResolvedValue(kase);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    enrichCaseUseCase.mockResolvedValue(enrichedCase);

    const result = await findCaseByIdUseCase("test-case-id");

    expect(findById).toHaveBeenCalledWith("test-case-id");
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(kase.workflowCode);
    expect(enrichCaseUseCase).toHaveBeenCalledWith(kase, mockWorkflow);
    expect(result).toEqual(enrichedCase);
  });

  it("throws when case not found", async () => {
    findById.mockResolvedValue(null);

    await expect(findCaseByIdUseCase("non-existent-case-id")).rejects.toThrow(
      'Case with id "non-existent-case-id" not found',
    );

    expect(findById).toHaveBeenCalledWith("non-existent-case-id");
    expect(findWorkflowByCodeUseCase).not.toHaveBeenCalled();
    expect(enrichCaseUseCase).not.toHaveBeenCalled();
  });

  it("throws when workflow not found", async () => {
    const kase = Case.createMock({ _id: "test-case-id" });

    findById.mockResolvedValue(kase);
    findWorkflowByCodeUseCase.mockResolvedValue(null);

    await expect(findCaseByIdUseCase("test-case-id")).rejects.toThrow(
      `Workflow with code "${kase.workflowCode}" not found`,
    );

    expect(findById).toHaveBeenCalledWith("test-case-id");
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(kase.workflowCode);
    expect(enrichCaseUseCase).not.toHaveBeenCalled();
  });

  it("finds case with assigned user and populates user name", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock({
      assignedUser: { id: mockUser.id },
    });
    const enrichedCase = {
      ...mockCase,
      assignedUser: { id: mockUser.id, name: mockUser.name },
      requiredRoles: mockWorkflow.requiredRoles,
    };

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    enrichCaseUseCase.mockResolvedValue(enrichedCase);

    const result = await findCaseByIdUseCase(mockCase._id);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(enrichCaseUseCase).toHaveBeenCalledWith(mockCase, mockWorkflow);
    expect(result.assignedUser.name).toBe(mockUser.name);
    expect(result.requiredRoles).toEqual(mockWorkflow.requiredRoles);
  });

  it("finds workflow by code and assigns requiredRoles to case", async () => {
    const mockWorkflow = Workflow.createMock({
      requiredRoles: ["ROLE_A", "ROLE_B"],
    });
    const mockCase = Case.createMock({
      workflowCode: "TEST_WORKFLOW",
    });
    const enrichedCase = {
      ...mockCase,
      requiredRoles: ["ROLE_A", "ROLE_B"],
    };

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    enrichCaseUseCase.mockResolvedValue(enrichedCase);

    const result = await findCaseByIdUseCase(mockCase._id);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("TEST_WORKFLOW");
    expect(enrichCaseUseCase).toHaveBeenCalledWith(mockCase, mockWorkflow);
    expect(result.requiredRoles).toEqual(["ROLE_A", "ROLE_B"]);
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
    const enrichedCase = {
      ...mockCase,
      assignedUser: { id: mockUser.id, name: mockUser.name },
      requiredRoles: ["USER_ROLE"],
    };

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    enrichCaseUseCase.mockResolvedValue(enrichedCase);

    const result = await findCaseByIdUseCase(mockCase._id);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("USER_WORKFLOW");
    expect(enrichCaseUseCase).toHaveBeenCalledWith(mockCase, mockWorkflow);
    expect(result.assignedUser.name).toBe(mockUser.name);
    expect(result.requiredRoles).toEqual(["USER_ROLE"]);
  });

  it("throws when workflow lookup fails", async () => {
    const mockCase = Case.createMock({
      workflowCode: "INVALID_WORKFLOW",
    });
    const workflowError = new Error("Workflow not found");

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockRejectedValue(workflowError);

    await expect(findCaseByIdUseCase(mockCase._id)).rejects.toThrow(
      "Workflow not found",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("INVALID_WORKFLOW");
    expect(enrichCaseUseCase).not.toHaveBeenCalled();
  });
});
