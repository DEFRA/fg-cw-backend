import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "../../common/auth.js";
import { User } from "../../users/models/user.js";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { assignUserToCaseUseCase } from "./assign-user-to-case.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../../common/auth.js");
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
    mockCase.assignUser = vi.fn();

    const mockWorkflow = Workflow.createMock();
    const authenticatedUser = { id: "auth-user-123" };

    randomUUID.mockReturnValue("BNHYYSYUSY4455-0099-DSDDSD");

    const mockUser = User.createMock({
      appRoles: {
        ROLE_1: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
        ROLE_2: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
        ROLE_3: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      },
    });

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);

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
    expect(getAuthenticatedUser).toHaveBeenCalled();
    expect(mockCase.assignUser).toHaveBeenCalledWith({
      assignedUserId: mockUser.id,
      text: "This is a test comment",
      createdBy: authenticatedUser.id,
    });

    expect(update).toHaveBeenCalledWith(mockCase);
  });

  it("throws when findById throws", async () => {
    const caseError = new Error("Case not found");
    const mockUser = User.createMock();

    findById.mockRejectedValueOnce(caseError);

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

  it("throws not found when when case is null or undefined", async () => {
    const mockUser = User.createMock();

    await expect(
      assignUserToCaseUseCase({
        caseId: "invalid-case-id",
        assignedUserId: mockUser.id,
      }),
    ).rejects.toThrow('Case with id "invalid-case-id" not found');
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
    mockCase.assignUser = vi.fn();

    const mockWorkflow = Workflow.createMock();
    const mockUser = User.createMock({
      appRoles: {
        ROLE_1: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
        ROLE_2: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
        ROLE_3: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      },
    });
    const authenticatedUser = { id: "auth-user-123" };
    const repositoryError = new Error("Database update failed");

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);
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
    const authenticatedUser = { id: "auth-user-123" };
    const mockUser = User.createMock({
      appRoles: {
        ROLE_1: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      },
    });

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);

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
    mockCase.unassignUser = vi.fn();
    const authenticatedUser = { id: "auth-user-123" };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);

    await assignUserToCaseUseCase({
      caseId: mockCase._id,
      assignedUserId: null,
      notes: "Unassigning user",
    });

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(getAuthenticatedUser).toHaveBeenCalled();
    expect(mockCase.unassignUser).toHaveBeenCalledWith({
      text: "Unassigning user",
      createdBy: authenticatedUser.id,
    });
    expect(update).toHaveBeenCalledWith(mockCase);
    expect(findUserByIdUseCase).not.toHaveBeenCalled();
    expect(findWorkflowByCodeUseCase).not.toHaveBeenCalled();
  });
});
