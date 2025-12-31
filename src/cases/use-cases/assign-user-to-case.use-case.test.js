import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRole } from "../../users/models/app-role.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
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

    const mockWorkflow = Workflow.createMock({
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
    });

    randomUUID.mockReturnValue("BNHYYSYUSY4455-0099-DSDDSD");

    const userToAssign = User.createMock({
      appRoles: {
        ROLE_1: new AppRole({
          name: "ROLE_1",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_2: new AppRole({
          name: "ROLE_2",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_3: new AppRole({
          name: "ROLE_3",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
      },
    });

    const mockUser = User.createMock({
      id: "user-123",
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {
        ROLE_1: new AppRole({
          name: "ROLE_1",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_2: new AppRole({
          name: "ROLE_2",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_3: new AppRole({
          name: "ROLE_3",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
      },
    });

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(userToAssign);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await assignUserToCaseUseCase({
      caseId: mockCase._id,
      assignedUserId: userToAssign.id,
      notes: "This is a test comment",
      user: mockUser,
    });

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(userToAssign.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(mockCase.assignUser).toHaveBeenCalledWith({
      assignedUserId: userToAssign.id,
      text: "This is a test comment",
      createdBy: "user-123",
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
        user: User.createMock({
          id: "user-123",
          idpRoles: [IdpRoles.ReadWrite],
        }),
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
        user: User.createMock({
          id: "user-123",
          idpRoles: [IdpRoles.ReadWrite],
        }),
      }),
    ).rejects.toThrow('Case with id "invalid-case-id" not found');
  });

  it("throws when user is not found", async () => {
    const mockCase = Case.createMock();
    const userError = new Error("User not found");

    const mockWorkflow = Workflow.createMock({
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
    });

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    findUserByIdUseCase.mockRejectedValue(userError);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: "invalid-user-id",
        user: User.createMock({
          id: "user-123",
          idpRoles: [IdpRoles.ReadWrite],
          appRoles: {
            ROLE_1: new AppRole({
              name: "ROLE_1",
              startDate: "1960-01-01",
              endDate: "2100-01-01",
            }),
            ROLE_2: new AppRole({
              name: "ROLE_2",
              startDate: "1960-01-01",
              endDate: "2100-01-01",
            }),
            ROLE_3: new AppRole({
              name: "ROLE_3",
              startDate: "1960-01-01",
              endDate: "2100-01-01",
            }),
          },
        }),
      }),
    ).rejects.toThrow("User not found");

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith("invalid-user-id");
    expect(update).not.toHaveBeenCalled();
  });

  it("throws forbidden when user does not have ReadWrite role", async () => {
    const mockCase = Case.createMock();

    const mockWorkflow = Workflow.createMock({
      requiredRoles: {
        allOf: [],
        anyOf: [],
      },
    });

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    const mockUser = User.createMock({
      id: "user-123",
      idpRoles: [IdpRoles.Read],
      appRoles: {},
    });

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: "507f1f77bcf86cd799439011",
        user: mockUser,
      }),
    ).rejects.toThrow(
      `User ${mockUser.id} does not have required roles to perform action`,
    );

    expect(findUserByIdUseCase).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws forbidden when user does not have required workflow roles", async () => {
    const mockCase = Case.createMock();

    const mockWorkflow = Workflow.createMock({
      requiredRoles: {
        allOf: ["ROLE_1"],
        anyOf: [],
      },
    });

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    const mockUser = User.createMock({
      id: "user-123",
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {},
    });

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: "507f1f77bcf86cd799439011",
        user: mockUser,
      }),
    ).rejects.toThrow(
      `User ${mockUser.id} does not have required roles to perform action`,
    );

    expect(findUserByIdUseCase).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when workflow is not found", async () => {
    const mockCase = Case.createMock();
    const mockUser = User.createMock();
    const workflowError = new Error("Workflow not found");

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockRejectedValue(workflowError);
    findUserByIdUseCase.mockResolvedValue(mockUser);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: mockUser.id,
        user: User.createMock({
          id: "user-123",
          idpRoles: [IdpRoles.ReadWrite],
          appRoles: {
            ROLE_1: new AppRole({
              name: "ROLE_1",
              startDate: "1960-01-01",
              endDate: "2100-01-01",
            }),
            ROLE_2: new AppRole({
              name: "ROLE_2",
              startDate: "1960-01-01",
              endDate: "2100-01-01",
            }),
            ROLE_3: new AppRole({
              name: "ROLE_3",
              startDate: "1960-01-01",
              endDate: "2100-01-01",
            }),
          },
        }),
      }),
    ).rejects.toThrow("Workflow not found");

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(findUserByIdUseCase).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when update fails", async () => {
    const mockCase = Case.createMock();
    mockCase.assignUser = vi.fn();

    const mockWorkflow = Workflow.createMock({
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
    });

    const userToAssign = User.createMock({
      appRoles: {
        ROLE_1: new AppRole({
          name: "ROLE_1",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_2: new AppRole({
          name: "ROLE_2",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_3: new AppRole({
          name: "ROLE_3",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
      },
    });

    const mockUser = User.createMock({
      id: "user-123",
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {
        ROLE_1: new AppRole({
          name: "ROLE_1",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_2: new AppRole({
          name: "ROLE_2",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_3: new AppRole({
          name: "ROLE_3",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
      },
    });

    const repositoryError = new Error("Database update failed");

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(userToAssign);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);
    update.mockRejectedValue(repositoryError);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: userToAssign.id,
        user: mockUser,
      }),
    ).rejects.toThrow("Database update failed");

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(userToAssign.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(update).toHaveBeenCalledWith(mockCase);
  });

  it("throws when user lacks required roles", async () => {
    const mockCase = Case.createMock();

    const mockWorkflow = Workflow.createMock({
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
    });

    const userToAssign = User.createMock({
      appRoles: {
        ROLE_1: new AppRole({
          name: "ROLE_1",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
      },
    });

    const mockUser = User.createMock({
      id: "user-123",
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {
        ROLE_1: new AppRole({
          name: "ROLE_1",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_2: new AppRole({
          name: "ROLE_2",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
        ROLE_3: new AppRole({
          name: "ROLE_3",
          startDate: "1960-01-01",
          endDate: "2100-01-01",
        }),
      },
    });

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(userToAssign);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await expect(
      assignUserToCaseUseCase({
        caseId: mockCase._id,
        assignedUserId: userToAssign.id,
        user: mockUser,
      }),
    ).rejects.toThrow(
      `User with id "${userToAssign.id}" does not have the required permissions to be assigned to this case.`,
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(userToAssign.id);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("unassigns user when assignedUserId is null", async () => {
    const mockCase = Case.createMock();
    mockCase.unassignUser = vi.fn();

    const mockWorkflow = Workflow.createMock({
      requiredRoles: {
        allOf: [],
        anyOf: [],
      },
    });

    const mockUser = User.createMock({
      id: "user-123",
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {},
    });

    findById.mockResolvedValue(mockCase);
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await assignUserToCaseUseCase({
      caseId: mockCase._id,
      assignedUserId: null,
      notes: "Unassigning user",
      user: mockUser,
    });

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(mockCase.unassignUser).toHaveBeenCalledWith({
      text: "Unassigning user",
      createdBy: "user-123",
    });
    expect(update).toHaveBeenCalledWith(mockCase);
    expect(findUserByIdUseCase).not.toHaveBeenCalled();
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      mockCase.workflowCode,
    );
  });
});
