import { beforeEach, describe, expect, it, vi } from "vitest";
import * as externalEndpointClient from "../../common/external-endpoint-client.js";
import * as parameterResolver from "../../common/parameter-resolver.js";
import { externalActionUseCase } from "./external-action.use-case.js";

vi.mock("../../common/external-endpoint-client.js");
vi.mock("../../common/parameter-resolver.js");

describe("externalActionUseCase", () => {
  let mockCallExternalEndpoint;
  let mockExtractEndpointParameters;

  beforeEach(() => {
    mockCallExternalEndpoint = vi.fn();
    mockExtractEndpointParameters = vi.fn();

    vi.spyOn(externalEndpointClient, "callExternalEndpoint").mockImplementation(
      mockCallExternalEndpoint,
    );
    vi.spyOn(parameterResolver, "extractEndpointParameters").mockImplementation(
      mockExtractEndpointParameters,
    );
  });

  it("should successfully execute action and return response", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        name: "Test Action",
        endpoint: { code: "TEST_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "TEST_ENDPOINT",
        method: "POST",
        path: "/test",
      }),
    };

    const mockCaseWorkflowContext = {
      workflow: mockWorkflow,
      _id: "case-123",
      payload: { data: "test" },
    };

    const mockParams = { PATH: { id: "case-123" }, BODY: {} };
    const mockResponse = { success: true, data: "response" };

    mockExtractEndpointParameters.mockResolvedValue(mockParams);
    mockCallExternalEndpoint.mockResolvedValue(mockResponse);

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
    });

    expect(result).toEqual(mockResponse);
  });

  it("should handle throwOnError parameter", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "TEST_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "TEST_ENDPOINT",
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };
    const error = new Error("Test error");

    mockExtractEndpointParameters.mockResolvedValue({});
    mockCallExternalEndpoint.mockRejectedValue(error);

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
      throwOnError: false,
    });

    expect(result).toEqual({});
  });

  it("should return empty object when response is null", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "TEST_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "TEST_ENDPOINT",
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };

    mockExtractEndpointParameters.mockResolvedValue({});
    mockCallExternalEndpoint.mockResolvedValue(null);

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
    });

    expect(result).toEqual({});
  });

  it("should return empty object when response is undefined", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "TEST_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "TEST_ENDPOINT",
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };

    mockExtractEndpointParameters.mockResolvedValue({});
    mockCallExternalEndpoint.mockResolvedValue(undefined);

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
    });

    expect(result).toEqual({});
  });

  it("should return empty object when action not found and throwOnError is false", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue(null),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };

    const result = await externalActionUseCase({
      actionCode: "NON_EXISTENT_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
      throwOnError: false,
    });

    expect(result).toEqual({});
  });

  it("should throw error when action not found and throwOnError is true", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue(null),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };

    await expect(
      externalActionUseCase({
        actionCode: "NON_EXISTENT_ACTION",
        caseWorkflowContext: mockCaseWorkflowContext,
        throwOnError: true,
      }),
    ).rejects.toThrow("No endpoint defined for action: NON_EXISTENT_ACTION");
  });

  it("should return empty object when action has no endpoint and throwOnError is false", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: null,
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
      throwOnError: false,
    });

    expect(result).toEqual({});
  });

  it("should throw error when action has no endpoint and throwOnError is true", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: null,
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };

    await expect(
      externalActionUseCase({
        actionCode: "TEST_ACTION",
        caseWorkflowContext: mockCaseWorkflowContext,
        throwOnError: true,
      }),
    ).rejects.toThrow("No endpoint defined for action: TEST_ACTION");
  });

  it("should return empty object when endpoint not found and throwOnError is false", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "NON_EXISTENT_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue(null),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
      throwOnError: false,
    });

    expect(result).toEqual({});
  });

  it("should throw error when endpoint not found and throwOnError is true", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "NON_EXISTENT_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue(null),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };

    await expect(
      externalActionUseCase({
        actionCode: "TEST_ACTION",
        caseWorkflowContext: mockCaseWorkflowContext,
        throwOnError: true,
      }),
    ).rejects.toThrow("Endpoint not found: NON_EXISTENT_ENDPOINT");
  });

  it("should return empty object on error when throwOnError is false", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "TEST_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "TEST_ENDPOINT",
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };
    const error = new Error("Test error");

    mockExtractEndpointParameters.mockResolvedValue({});
    mockCallExternalEndpoint.mockRejectedValue(error);

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
      throwOnError: false,
    });

    expect(result).toEqual({});
  });

  it("should throw error when throwOnError is true", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "TEST_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "TEST_ENDPOINT",
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };
    const error = new Error("Test error");

    mockExtractEndpointParameters.mockResolvedValue({});
    mockCallExternalEndpoint.mockRejectedValue(error);

    await expect(
      externalActionUseCase({
        actionCode: "TEST_ACTION",
        caseWorkflowContext: mockCaseWorkflowContext,
        throwOnError: true,
      }),
    ).rejects.toThrow("Test error");
  });

  it("should handle validation error during parameter extraction", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "TEST_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "TEST_ENDPOINT",
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };
    const error = new Error("Parameter extraction error");

    mockExtractEndpointParameters.mockRejectedValue(error);

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
      throwOnError: false,
    });

    expect(result).toEqual({});
  });

  it("should handle empty response object", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "TEST_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "TEST_ENDPOINT",
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };
    const mockResponse = {};

    mockExtractEndpointParameters.mockResolvedValue({});
    mockCallExternalEndpoint.mockResolvedValue(mockResponse);

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
    });

    expect(result).toEqual({});
  });

  it("should handle complex response object", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "TEST_ENDPOINT" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "TEST_ENDPOINT",
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };
    const mockResponse = {
      data: { items: [1, 2, 3] },
      metadata: { count: 3, total: 100 },
    };

    mockExtractEndpointParameters.mockResolvedValue({});
    mockCallExternalEndpoint.mockResolvedValue(mockResponse);

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
    });

    expect(result).toEqual(mockResponse);
  });

  it("should handle different endpoint methods", async () => {
    const mockWorkflow = {
      findExternalAction: vi.fn().mockReturnValue({
        code: "TEST_ACTION",
        endpoint: { code: "GET_ENDPOINT", method: "GET" },
      }),
      findEndpoint: vi.fn().mockReturnValue({
        code: "GET_ENDPOINT",
        method: "GET",
      }),
    };

    const mockCaseWorkflowContext = { workflow: mockWorkflow };
    const mockResponse = { data: "GET response" };

    mockExtractEndpointParameters.mockResolvedValue({});
    mockCallExternalEndpoint.mockResolvedValue(mockResponse);

    const result = await externalActionUseCase({
      actionCode: "TEST_ACTION",
      caseWorkflowContext: mockCaseWorkflowContext,
    });

    expect(result).toEqual(mockResponse);
    expect(mockCallExternalEndpoint).toHaveBeenCalledWith(
      { code: "GET_ENDPOINT", method: "GET" },
      {},
      mockCaseWorkflowContext,
      false,
    );
  });
});
