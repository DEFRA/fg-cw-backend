import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { updateAssignedUser } from "../repositories/case.repository.js";
import { assignUserToCaseUseCase } from "./assign-user-to-case.use-case.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../../users/use-cases/find-user-by-id.use-case.js");
vi.mock("../repositories/case.repository.js");
vi.mock("./find-case-by-id.use-case.js");
vi.mock("./find-workflow-by-code.use-case.js");

describe("assignUserToCaseUseCase", () => {
  it("assigns user to case when user has required roles", async () => {
    const mockCase = Case.createMock();
    const mockWorkflow = Workflow.createMock();

    const mockUser = User.createMock({
      appRoles: ["ROLE_1", "ROLE_2", "ROLE_3"],
    });

    findCaseByIdUseCase.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await assignUserToCaseUseCase({
      caseId: mockCase._id,
      assignedUserId: mockUser.id,
    });

    expect(findCaseByIdUseCase).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );

    expect(updateAssignedUser).toHaveBeenCalledWith(mockCase._id, mockUser.id);
  });

  it("throws when case is not found", async () => {
    const caseError = new Error("Case not found");
    const mockUser = User.createMock();

    findCaseByIdUseCase.mockRejectedValue(caseError);

    await expect(
      assignUserToCaseUseCase({
        caseId: "invalid-case-id",
        assignedUserId: mockUser.id,
      }),
    ).rejects.toThrow("Case not found");

    expect(findCaseByIdUseCase).toHaveBeenCalledWith("invalid-case-id");
    expect(findUserByIdUseCase).not.toHaveBeenCalled();
    expect(findWorkflowByCodeUseCase).not.toHaveBeenCalled();
    expect(updateAssignedUser).not.toHaveBeenCalled();
  });

  it("throws when user is not found", async () => {
    const mockCase = Case.createMock();
    const userError = new Error("User not found");

    findCaseByIdUseCase.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockRejectedValue(userError);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: "invalid-user-id",
      }),
    ).rejects.toThrow("User not found");

    expect(findCaseByIdUseCase).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith("invalid-user-id");
    expect(updateAssignedUser).not.toHaveBeenCalled();
  });

  it("throws when workflow is not found", async () => {
    const mockCase = Case.createMock();
    const mockUser = User.createMock();
    const workflowError = new Error("Workflow not found");

    findCaseByIdUseCase.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockRejectedValue(workflowError);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: mockUser.id,
      }),
    ).rejects.toThrow("Workflow not found");

    expect(findCaseByIdUseCase).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(updateAssignedUser).not.toHaveBeenCalled();
  });

  it("throws when update fails", async () => {
    const mockCase = Case.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockUser = User.createMock({
      appRoles: ["ROLE_1", "ROLE_2", "ROLE_3"],
    });
    const repositoryError = new Error("Database update failed");

    findCaseByIdUseCase.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    updateAssignedUser.mockRejectedValue(repositoryError);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: mockUser.id,
      }),
    ).rejects.toThrow("Database update failed");

    expect(findCaseByIdUseCase).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(updateAssignedUser).toHaveBeenCalledWith(mockCase._id, mockUser.id);
  });

  it("throws when user lacks required roles", async () => {
    const mockCase = Case.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockUser = User.createMock({
      appRoles: ["ROLE_1"],
    });

    findCaseByIdUseCase.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: mockUser.id,
      }),
    ).rejects.toThrow(
      `User with id "${mockUser.id}" does not have the required permissions to be assigned to this case.`,
    );

    expect(findCaseByIdUseCase).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(updateAssignedUser).not.toHaveBeenCalled();
  });

  it("unassigns user when assignedUserId is null", async () => {
    const mockCase = Case.createMock();

    await assignUserToCaseUseCase({
      caseId: mockCase._id,
      assignedUserId: null,
    });

    expect(updateAssignedUser).toHaveBeenCalledWith(mockCase._id, null);
    expect(findCaseByIdUseCase).not.toHaveBeenCalled();
    expect(findUserByIdUseCase).not.toHaveBeenCalled();
    expect(findWorkflowByCodeUseCase).not.toHaveBeenCalled();
  });
});
