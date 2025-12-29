import { describe, expect, it, vi } from "vitest";
import { createCaseWorkflowContext } from "../../common/build-view-model.js";
import { AppRole } from "../../users/models/app-role.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { externalActionUseCase } from "./external-action.use-case.js";
import { performPageActionUseCase } from "./perform-page-action.use-case.js";

vi.mock("../../common/build-view-model.js");
vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");
vi.mock("./external-action.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("performPageActionUseCase", () => {
  const mockUser = User.createMock({
    id: "user-123",
    idpRoles: [IdpRoles.ReadWrite],
  });

  const createMockCase = () => ({
    _id: "64c88faac1f56f71e1b89a33",
    caseRef: "REF-001",
    workflowCode: "FRPS",
    supplementaryData: {
      rulesCalculations: [
        { id: 905, valid: true, date: "2025-10-25T22:08:43.553Z" },
      ],
    },
    updateSupplementaryData: vi.fn(),
    addExternalActionTimelineEvent: vi.fn(),
  });

  const createMockWorkflow = (overrides = {}) => {
    const { externalActions, endpoints, ...restOverrides } = overrides;

    return Workflow.createMock({
      code: "FRPS",
      ...restOverrides,
      externalActions: externalActions ?? [
        {
          code: "RECALCULATE_RULES",
          name: "Run calculations again",
          display: true,
          endpoint: {
            code: "RECALCULATE_RULES_ENDPOINT",
            endpointParams: {
              BODY: {
                id: "$.supplementaryData.rulesCalculations[0].id",
                requesterUsername: "CASEWORKING_SYSTEM",
              },
            },
          },
          target: {
            position: null,
            targetNode: "rulesCalculations",
            dataType: "ARRAY",
            place: "append",
          },
        },
        {
          code: "FETCH_RULES",
          name: "Fetch Rules",
          display: false,
          endpoint: {
            code: "FETCH_RULES_ENDPOINT",
            endpointParams: {
              PATH: {
                runId: "$.supplementaryData.rulesCalculations[0].id",
              },
            },
          },
          target: null,
        },
      ],
      endpoints: endpoints ?? [
        {
          code: "RECALCULATE_RULES_ENDPOINT",
          service: "RULES_ENGINE",
          path: "/api/rerun",
          method: "POST",
        },
      ],
    });
  };

  it("throws forbidden when user does not have ReadWrite role", async () => {
    const user = User.createMock({
      id: "user-123",
      idpRoles: [IdpRoles.Read],
    });

    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    await expect(
      performPageActionUseCase({
        caseId: "64c88faac1f56f71e1b89a33",
        actionCode: "RECALCULATE_RULES",
        user,
      }),
    ).rejects.toThrow(
      `User ${user.id} does not have required roles to perform action`,
    );

    expect(externalActionUseCase).not.toHaveBeenCalled();
  });

  it("throws forbidden when user does not have required workflow roles", async () => {
    const user = User.createMock({
      id: "user-123",
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {
        ROLE_1: new AppRole({
          name: "ROLE_1",
          startDate: "2025-07-01",
          endDate: "2100-01-01",
        }),
      },
    });

    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    await expect(
      performPageActionUseCase({
        caseId: "64c88faac1f56f71e1b89a33",
        actionCode: "RECALCULATE_RULES",
        user,
      }),
    ).rejects.toThrow(
      `User ${user.id} does not have required roles to perform action`,
    );

    expect(externalActionUseCase).not.toHaveBeenCalled();
  });

  it("should perform action, store response and add timeline event when target is defined and display is true", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    const mockResponse = {
      id: 906,
      valid: false,
      message: "Application validated successfully",
      date: "2025-10-26T22:08:43.553Z",
    };

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);
    externalActionUseCase.mockResolvedValue(mockResponse);
    createCaseWorkflowContext.mockReturnValue({
      ...mockCase,
      workflow: mockWorkflow,
    });
    update.mockResolvedValue(mockCase);

    const result = await performPageActionUseCase({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "RECALCULATE_RULES",
      user: mockUser,
    });

    expect(result).toEqual(mockResponse);
    expect(findById).toHaveBeenCalledWith("64c88faac1f56f71e1b89a33");
    expect(findByCode).toHaveBeenCalledWith("FRPS");
    expect(externalActionUseCase).toHaveBeenCalledWith({
      actionCode: "RECALCULATE_RULES",
      caseWorkflowContext: { ...mockCase, workflow: mockWorkflow },
      throwOnError: true,
    });
    expect(mockCase.updateSupplementaryData).toHaveBeenCalledWith({
      targetNode: "rulesCalculations",
      dataType: "ARRAY",
      key: undefined,
      data: mockResponse,
    });
    expect(mockCase.addExternalActionTimelineEvent).toHaveBeenCalledWith({
      actionName: "Run calculations again",
      createdBy: "user-123",
    });
    expect(update).toHaveBeenCalledWith(mockCase);
  });

  it("should perform action but not store or add timeline event when target is null and display is false", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    const mockResponse = {
      id: 906,
      valid: false,
      message: "Application validated successfully",
    };

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);
    externalActionUseCase.mockResolvedValue(mockResponse);
    createCaseWorkflowContext.mockReturnValue({
      ...mockCase,
      workflow: mockWorkflow,
    });

    const result = await performPageActionUseCase({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "FETCH_RULES",
      user: mockUser,
    });

    expect(result).toEqual(mockResponse);
    expect(mockCase.updateSupplementaryData).not.toHaveBeenCalled();
    expect(mockCase.addExternalActionTimelineEvent).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("should add timeline event but not store response when response is empty", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    const mockResponse = {};

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);
    externalActionUseCase.mockResolvedValue(mockResponse);
    createCaseWorkflowContext.mockReturnValue({
      ...mockCase,
      workflow: mockWorkflow,
    });
    update.mockResolvedValue(mockCase);

    const result = await performPageActionUseCase({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "RECALCULATE_RULES",
      user: mockUser,
    });

    expect(result).toEqual(mockResponse);
    expect(mockCase.updateSupplementaryData).not.toHaveBeenCalled();
    expect(mockCase.addExternalActionTimelineEvent).toHaveBeenCalledWith({
      actionName: "Run calculations again",
      createdBy: "user-123",
    });
    expect(update).toHaveBeenCalledWith(mockCase);
  });

  it("should add timeline event even if response is null", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    const mockResponse = null;

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);
    externalActionUseCase.mockResolvedValue(mockResponse);
    createCaseWorkflowContext.mockReturnValue({
      ...mockCase,
      workflow: mockWorkflow,
    });
    update.mockResolvedValue(mockCase);

    const result = await performPageActionUseCase({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "RECALCULATE_RULES",
      user: mockUser,
    });

    expect(result).toBeNull();
    expect(mockCase.updateSupplementaryData).not.toHaveBeenCalled();
    expect(mockCase.addExternalActionTimelineEvent).toHaveBeenCalledWith({
      actionName: "Run calculations again",
      createdBy: "user-123",
    });
    expect(update).toHaveBeenCalledWith(mockCase);
  });

  it("should throw error when case is not found", async () => {
    findById.mockResolvedValue(null);

    await expect(
      performPageActionUseCase({
        caseId: "64c88faac1f56f71e1b89a33",
        actionCode: "RECALCULATE_RULES",
        user: mockUser,
      }),
    ).rejects.toThrow("Case not found: 64c88faac1f56f71e1b89a33");
  });

  it("should throw error when workflow is not found", async () => {
    const mockCase = createMockCase();
    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(null);

    await expect(
      performPageActionUseCase({
        caseId: "64c88faac1f56f71e1b89a33",
        actionCode: "RECALCULATE_RULES",
        user: mockUser,
      }),
    ).rejects.toThrow("Workflow not found: FRPS");
  });

  it("should throw error when external action is not found", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    await expect(
      performPageActionUseCase({
        caseId: "64c88faac1f56f71e1b89a33",
        actionCode: "NONEXISTENT_ACTION",
        user: mockUser,
      }),
    ).rejects.toThrow("External action not found: NONEXISTENT_ACTION");
  });
});
