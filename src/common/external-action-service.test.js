import { beforeEach, describe, expect, it, vi } from "vitest";
import { Workflow } from "../cases/models/workflow.js";
import { callAPIAndFetchData } from "./external-action-service.js";

vi.mock("./external-endpoint-client.js");
vi.mock("./parameter-resolver.js");
vi.mock("./workflow-helpers.js");
vi.mock("./logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("external-action-service", () => {
  let mockCallExternalEndpoint;
  let mockExtractEndpointParameters;
  let mockFindExternalAction;
  let mockFindEndpoint;
  let logger;

  beforeEach(async () => {
    vi.clearAllMocks();

    const externalEndpointClient = await import(
      "./external-endpoint-client.js"
    );
    const parameterResolver = await import("./parameter-resolver.js");
    const workflowHelpers = await import("./workflow-helpers.js");
    const loggerModule = await import("./logger.js");

    mockCallExternalEndpoint = vi.spyOn(
      externalEndpointClient,
      "callExternalEndpoint",
    );
    mockExtractEndpointParameters = vi.spyOn(
      parameterResolver,
      "extractEndpointParameters",
    );
    mockFindExternalAction = vi.spyOn(workflowHelpers, "findExternalAction");
    mockFindEndpoint = vi.spyOn(workflowHelpers, "findEndpoint");
    logger = loggerModule.logger;
  });

  const createMockWorkflow = () =>
    Workflow.createMock({
      code: "TEST_WORKFLOW",
      externalActions: [
        {
          code: "TEST_ACTION",
          endpoint: {
            code: "TEST_ENDPOINT",
          },
        },
      ],
      endpoints: [
        {
          code: "TEST_ENDPOINT",
          service: "TEST_SERVICE",
          path: "/api/test",
          method: "GET",
        },
      ],
    });

  const createMockContext = (workflow) => ({
    caseId: "64c88faac1f56f71e1b89a33",
    caseRef: "REF-001",
    workflowCode: "TEST_WORKFLOW",
    workflow,
    supplementaryData: {},
  });

  describe("callAPIAndFetchData", () => {
    it("should successfully call API and return response", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const mockResponse = { data: "test-data", id: 123 };
      const mockParams = {
        PATH: { id: "123" },
        BODY: {},
      };

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockResolvedValue(mockParams);
      mockCallExternalEndpoint.mockResolvedValue(mockResponse);

      const result = await callAPIAndFetchData({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
      });

      expect(result).toEqual(mockResponse);
      expect(logger.info).toHaveBeenCalledWith(
        { actionValue: "TEST_ACTION" },
        "Starting external service call for action: TEST_ACTION",
      );
      expect(mockFindExternalAction).toHaveBeenCalledWith(
        "TEST_ACTION",
        workflow,
      );
      expect(mockFindEndpoint).toHaveBeenCalledWith("TEST_ENDPOINT", workflow);
      expect(mockExtractEndpointParameters).toHaveBeenCalledWith({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
      });
      expect(mockCallExternalEndpoint).toHaveBeenCalledWith(
        workflow.endpoints[0],
        mockParams,
        context,
        false,
      );
      expect(logger.info).toHaveBeenCalledWith(
        { actionValue: "TEST_ACTION", endpoint: "TEST_ENDPOINT" },
        "Successfully fetched data from external service for action: TEST_ACTION",
      );
    });

    it("should handle throwOnError parameter", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const mockResponse = { data: "test-data" };
      const mockParams = { PATH: {}, BODY: {} };

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockResolvedValue(mockParams);
      mockCallExternalEndpoint.mockResolvedValue(mockResponse);

      await callAPIAndFetchData({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
        throwOnError: true,
      });

      expect(mockCallExternalEndpoint).toHaveBeenCalledWith(
        workflow.endpoints[0],
        mockParams,
        context,
        true,
      );
    });

    it("should return empty object when response is null", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const mockParams = { PATH: {}, BODY: {} };

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockResolvedValue(mockParams);
      mockCallExternalEndpoint.mockResolvedValue(null);

      const result = await callAPIAndFetchData({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
      });

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        { endpoint: "TEST_ENDPOINT" },
        "No response from external endpoint: TEST_ENDPOINT",
      );
    });

    it("should return empty object when response is undefined", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const mockParams = { PATH: {}, BODY: {} };

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockResolvedValue(mockParams);
      mockCallExternalEndpoint.mockResolvedValue(undefined);

      const result = await callAPIAndFetchData({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
      });

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        { endpoint: "TEST_ENDPOINT" },
        "No response from external endpoint: TEST_ENDPOINT",
      );
    });

    it("should return empty object when external action not found and throwOnError is false", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);

      mockFindExternalAction.mockReturnValue(null);

      const result = await callAPIAndFetchData({
        actionValue: "UNKNOWN_ACTION",
        caseWorkflowContext: context,
        throwOnError: false,
      });

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        { actionValue: "UNKNOWN_ACTION" },
        "No endpoint defined for action: UNKNOWN_ACTION",
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          actionValue: "UNKNOWN_ACTION",
        }),
        expect.stringContaining(
          "Failed to fetch data for action UNKNOWN_ACTION",
        ),
      );
    });

    it("should throw error when external action not found and throwOnError is true", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);

      mockFindExternalAction.mockReturnValue(null);

      await expect(
        callAPIAndFetchData({
          actionValue: "UNKNOWN_ACTION",
          caseWorkflowContext: context,
          throwOnError: true,
        }),
      ).rejects.toThrow("No endpoint defined for action: UNKNOWN_ACTION");

      expect(logger.warn).toHaveBeenCalledWith(
        { actionValue: "UNKNOWN_ACTION" },
        "No endpoint defined for action: UNKNOWN_ACTION",
      );
    });

    it("should return empty object when external action has no endpoint and throwOnError is false", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const actionWithoutEndpoint = {
        code: "NO_ENDPOINT_ACTION",
        endpoint: null,
      };

      mockFindExternalAction.mockReturnValue(actionWithoutEndpoint);

      const result = await callAPIAndFetchData({
        actionValue: "NO_ENDPOINT_ACTION",
        caseWorkflowContext: context,
        throwOnError: false,
      });

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        { actionValue: "NO_ENDPOINT_ACTION" },
        "No endpoint defined for action: NO_ENDPOINT_ACTION",
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it("should throw error when external action has no endpoint and throwOnError is true", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const actionWithoutEndpoint = {
        code: "NO_ENDPOINT_ACTION",
        endpoint: null,
      };

      mockFindExternalAction.mockReturnValue(actionWithoutEndpoint);

      await expect(
        callAPIAndFetchData({
          actionValue: "NO_ENDPOINT_ACTION",
          caseWorkflowContext: context,
          throwOnError: true,
        }),
      ).rejects.toThrow("No endpoint defined for action: NO_ENDPOINT_ACTION");
    });

    it("should return empty object when endpoint not found and throwOnError is false", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(null);

      const result = await callAPIAndFetchData({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
        throwOnError: false,
      });

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        { endpointCode: "TEST_ENDPOINT" },
        "Endpoint not found: TEST_ENDPOINT",
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it("should throw error when endpoint not found and throwOnError is true", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(null);

      await expect(
        callAPIAndFetchData({
          actionValue: "TEST_ACTION",
          caseWorkflowContext: context,
          throwOnError: true,
        }),
      ).rejects.toThrow("Endpoint not found: TEST_ENDPOINT");

      expect(logger.warn).toHaveBeenCalledWith(
        { endpointCode: "TEST_ENDPOINT" },
        "Endpoint not found: TEST_ENDPOINT",
      );
    });

    it("should return empty object on error when throwOnError is false", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const mockParams = { PATH: {}, BODY: {} };
      const testError = new Error("Network failure");

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockResolvedValue(mockParams);
      mockCallExternalEndpoint.mockRejectedValue(testError);

      const result = await callAPIAndFetchData({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
        throwOnError: false,
      });

      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalledWith(
        { error: testError, actionValue: "TEST_ACTION" },
        "Failed to fetch data for action TEST_ACTION: Network failure",
      );
    });

    it("should throw error when throwOnError is true", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const mockParams = { PATH: {}, BODY: {} };
      const testError = new Error("Connection timeout");

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockResolvedValue(mockParams);
      mockCallExternalEndpoint.mockRejectedValue(testError);

      await expect(
        callAPIAndFetchData({
          actionValue: "TEST_ACTION",
          caseWorkflowContext: context,
          throwOnError: true,
        }),
      ).rejects.toThrow("Connection timeout");

      expect(logger.error).toHaveBeenCalledWith(
        { error: testError, actionValue: "TEST_ACTION" },
        "Failed to fetch data for action TEST_ACTION: Connection timeout",
      );
    });

    it("should handle validation error during parameter extraction", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const validationError = new Error("Invalid parameter format");

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockRejectedValue(validationError);

      const result = await callAPIAndFetchData({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
        throwOnError: false,
      });

      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalledWith(
        { error: validationError, actionValue: "TEST_ACTION" },
        "Failed to fetch data for action TEST_ACTION: Invalid parameter format",
      );
    });

    it("should handle empty response object", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const mockParams = { PATH: {}, BODY: {} };
      const emptyResponse = {};

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockResolvedValue(mockParams);
      mockCallExternalEndpoint.mockResolvedValue(emptyResponse);

      const result = await callAPIAndFetchData({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
      });

      expect(result).toEqual({});
      expect(logger.info).toHaveBeenCalledWith(
        { actionValue: "TEST_ACTION", endpoint: "TEST_ENDPOINT" },
        "Successfully fetched data from external service for action: TEST_ACTION",
      );
    });

    it("should handle complex response object", async () => {
      const workflow = createMockWorkflow();
      const context = createMockContext(workflow);
      const mockParams = { PATH: { id: "123" }, BODY: {} };
      const complexResponse = {
        id: 123,
        data: {
          nested: {
            value: "test",
            array: [1, 2, 3],
          },
        },
        metadata: {
          timestamp: "2025-11-25T10:00:00Z",
          valid: true,
        },
      };

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockResolvedValue(mockParams);
      mockCallExternalEndpoint.mockResolvedValue(complexResponse);

      const result = await callAPIAndFetchData({
        actionValue: "TEST_ACTION",
        caseWorkflowContext: context,
      });

      expect(result).toEqual(complexResponse);
      expect(logger.info).toHaveBeenCalledWith(
        { actionValue: "TEST_ACTION", endpoint: "TEST_ENDPOINT" },
        "Successfully fetched data from external service for action: TEST_ACTION",
      );
    });

    it("should handle different endpoint methods", async () => {
      const workflow = {
        code: "TEST_WORKFLOW",
        externalActions: [
          {
            code: "POST_ACTION",
            endpoint: {
              code: "POST_ENDPOINT",
            },
          },
        ],
        endpoints: [
          {
            code: "POST_ENDPOINT",
            service: "TEST_SERVICE",
            path: "/api/create",
            method: "POST",
          },
        ],
      };
      const context = createMockContext(workflow);
      const mockParams = {
        PATH: {},
        BODY: { name: "test", value: 42 },
      };
      const mockResponse = { id: 456, status: "created" };

      mockFindExternalAction.mockReturnValue(workflow.externalActions[0]);
      mockFindEndpoint.mockReturnValue(workflow.endpoints[0]);
      mockExtractEndpointParameters.mockResolvedValue(mockParams);
      mockCallExternalEndpoint.mockResolvedValue(mockResponse);

      const result = await callAPIAndFetchData({
        actionValue: "POST_ACTION",
        caseWorkflowContext: context,
      });

      expect(result).toEqual(mockResponse);
      expect(mockCallExternalEndpoint).toHaveBeenCalledWith(
        workflow.endpoints[0],
        mockParams,
        context,
        false,
      );
    });
  });
});
