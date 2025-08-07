import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { assignUserToCaseUseCase } from "./assign-user-to-case.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../../users/use-cases/find-user-by-id.use-case.js");
vi.mock("../repositories/case.repository.js");
vi.mock("./find-case-by-id.use-case.js");
vi.mock("./find-workflow-by-code.use-case.js");
vi.mock("node:crypto");

describe("assignUserToCaseUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("assigns user to case when user has required roles", async () => {
    const mockCase = Case.createMock();
    const mockWorkflow = Workflow.createMock();

    randomUUID.mockReturnValue("BNHYYSYUSY4455-0099-DSDDSD");

    const mockUser = User.createMock({
      appRoles: ["ROLE_1", "ROLE_2", "ROLE_3"],
    });

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await assignUserToCaseUseCase({
      caseId: mockCase._id,
      assignedUserId: mockUser.id,
      notes: "This is a test comment",
    });

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );

    expect(update).toHaveBeenCalledWith(mockCase);
  });

  it("throws when case is not found", async () => {
    const caseError = new Error("Case not found");
    const mockUser = User.createMock();

    findById.mockRejectedValue(caseError);

    await expect(
      assignUserToCaseUseCase({
        caseId: "invalid-case-id",
        assignedUserId: mockUser.id,
      }),
    ).rejects.toThrow("Case not found");

    expect(findById).toHaveBeenCalledWith("invalid-case-id");
    expect(findUserByIdUseCase).not.toHaveBeenCalled();
    expect(findWorkflowByCodeUseCase).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when user is not found", async () => {
    const mockCase = Case.createMock();
    const userError = new Error("User not found");

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockRejectedValue(userError);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: "invalid-user-id",
      }),
    ).rejects.toThrow("User not found");

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith("invalid-user-id");
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when workflow is not found", async () => {
    const mockCase = Case.createMock();
    const mockUser = User.createMock();
    const workflowError = new Error("Workflow not found");

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockRejectedValue(workflowError);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: mockUser.id,
      }),
    ).rejects.toThrow("Workflow not found");

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when update fails", async () => {
    const mockCase = Case.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockUser = User.createMock({
      appRoles: ["ROLE_1", "ROLE_2", "ROLE_3"],
    });
    const repositoryError = new Error("Database update failed");

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    update.mockRejectedValue(repositoryError);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: mockUser.id,
      }),
    ).rejects.toThrow("Database update failed");

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(update).toHaveBeenCalledWith(mockCase);
  });

  it("throws when user lacks required roles", async () => {
    const mockCase = Case.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockUser = User.createMock({
      appRoles: ["ROLE_1"],
    });

    findById.mockResolvedValue(mockCase);
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

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("unassigns user when assignedUserId is null", async () => {
    const mockCase = Case.createMock();
    findById.mockResolvedValue(mockCase);

    await assignUserToCaseUseCase({
      caseId: mockCase._id,
      assignedUserId: null,
    });

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(update).toHaveBeenCalledWith(mockCase);
    expect(findUserByIdUseCase).not.toHaveBeenCalled();
    expect(findWorkflowByCodeUseCase).not.toHaveBeenCalled();
  });
});
