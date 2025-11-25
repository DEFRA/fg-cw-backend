import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workflow } from "../models/workflow.js";
import { performPageActionUseCase } from "./perform-page-action.use-case.js";

vi.mock("../../common/external-action-service.js");
vi.mock("../../common/build-view-model.js");
vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");
vi.mock("../../common/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("performPageActionUseCase", () => {
  let mockFindById;
  let mockFindByCode;
  let mockUpdate;
  let mockExternalActionUseCase;
  let mockCreateCaseWorkflowContext;

  beforeEach(async () => {
    vi.clearAllMocks();

    const caseRepository = await import("../repositories/case.repository.js");
    const workflowRepository = await import(
      "../repositories/workflow.repository.js"
    );
    const { ExternalActionUseCase } = await import(
      "./external-action.use-case.js"
    );
    const buildViewModel = await import("../../common/build-view-model.js");

    mockFindById = vi.spyOn(caseRepository, "findById");
    mockFindByCode = vi.spyOn(workflowRepository, "findByCode");
    mockUpdate = vi.spyOn(caseRepository, "update");
    mockExternalActionUseCase = vi.fn();
    vi.spyOn(ExternalActionUseCase, "create").mockReturnValue({
      execute: mockExternalActionUseCase,
    });
    mockCreateCaseWorkflowContext = vi.spyOn(
      buildViewModel,
      "createCaseWorkflowContext",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
  });

  const createMockWorkflow = () => {
    return Workflow.createMock({
      code: "FRPS",
      externalActions: [
        {
          code: "RECALCULATE_RULES",
          name: "Recalculate Rules",
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
          },
        },
        {
          code: "FETCH_RULES",
          name: "Fetch Rules",
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
      endpoints: [
        {
          code: "RECALCULATE_RULES_ENDPOINT",
          service: "RULES_ENGINE",
          path: "/api/rerun",
          method: "POST",
        },
      ],
    });
  };

  it("should perform action and store response when target is defined", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    const mockResponse = {
      id: 906,
      valid: false,
      message: "Application validated successfully",
      date: "2025-10-26T22:08:43.553Z",
    };

    mockFindById.mockResolvedValue(mockCase);
    mockFindByCode.mockResolvedValue(mockWorkflow);
    mockExternalActionUseCase.mockResolvedValue(mockResponse);
    mockCreateCaseWorkflowContext.mockReturnValue({
      ...mockCase,
      workflow: mockWorkflow,
    });
    mockUpdate.mockResolvedValue(mockCase);

    const result = await performPageActionUseCase({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "RECALCULATE_RULES",
    });

    expect(result).toEqual(mockResponse);
    expect(mockFindById).toHaveBeenCalledWith("64c88faac1f56f71e1b89a33");
    expect(mockFindByCode).toHaveBeenCalledWith("FRPS");
    expect(mockExternalActionUseCase).toHaveBeenCalledWith({
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
    expect(mockUpdate).toHaveBeenCalledWith(mockCase);
  });

  it("should perform action but not store when target is null", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    const mockResponse = {
      id: 906,
      valid: false,
      message: "Application validated successfully",
    };

    mockFindById.mockResolvedValue(mockCase);
    mockFindByCode.mockResolvedValue(mockWorkflow);
    mockExternalActionUseCase.mockResolvedValue(mockResponse);
    mockCreateCaseWorkflowContext.mockReturnValue({
      ...mockCase,
      workflow: mockWorkflow,
    });

    const result = await performPageActionUseCase({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "FETCH_RULES",
    });

    expect(result).toEqual(mockResponse);
    expect(mockCase.updateSupplementaryData).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should not store when response is empty", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    const mockResponse = {};

    mockFindById.mockResolvedValue(mockCase);
    mockFindByCode.mockResolvedValue(mockWorkflow);
    mockExternalActionUseCase.mockResolvedValue(mockResponse);
    mockCreateCaseWorkflowContext.mockReturnValue({
      ...mockCase,
      workflow: mockWorkflow,
    });

    const result = await performPageActionUseCase({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "RECALCULATE_RULES",
    });

    expect(result).toEqual(mockResponse);
    expect(mockCase.updateSupplementaryData).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should not store when response is null", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    const mockResponse = null;

    mockFindById.mockResolvedValue(mockCase);
    mockFindByCode.mockResolvedValue(mockWorkflow);
    mockExternalActionUseCase.mockResolvedValue(mockResponse);
    mockCreateCaseWorkflowContext.mockReturnValue({
      ...mockCase,
      workflow: mockWorkflow,
    });

    const result = await performPageActionUseCase({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "RECALCULATE_RULES",
    });

    expect(result).toBeNull();
    expect(mockCase.updateSupplementaryData).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should throw error when case is not found", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      performPageActionUseCase({
        caseId: "64c88faac1f56f71e1b89a33",
        actionCode: "RECALCULATE_RULES",
      }),
    ).rejects.toThrow("Case not found: 64c88faac1f56f71e1b89a33");
  });

  it("should throw error when workflow is not found", async () => {
    const mockCase = createMockCase();
    mockFindById.mockResolvedValue(mockCase);
    mockFindByCode.mockResolvedValue(null);

    await expect(
      performPageActionUseCase({
        caseId: "64c88faac1f56f71e1b89a33",
        actionCode: "RECALCULATE_RULES",
      }),
    ).rejects.toThrow("Workflow not found: FRPS");
  });

  it("should throw error when external action is not found", async () => {
    const mockCase = createMockCase();
    const mockWorkflow = createMockWorkflow();
    mockFindById.mockResolvedValue(mockCase);
    mockFindByCode.mockResolvedValue(mockWorkflow);

    await expect(
      performPageActionUseCase({
        caseId: "64c88faac1f56f71e1b89a33",
        actionCode: "NONEXISTENT_ACTION",
      }),
    ).rejects.toThrow("External action not found: NONEXISTENT_ACTION");
  });
});
