import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalActionUseCase } from "./external-action.use-case.js";

describe("ExternalActionUseCase", () => {
  let service;
  let mockEndpointClient;
  let mockParameterResolver;

  beforeEach(() => {
    mockEndpointClient = {
      callExternalEndpoint: vi.fn(),
    };
    mockParameterResolver = {
      extractEndpointParameters: vi.fn(),
    };

    service = new ExternalActionUseCase({
      endpointClient: mockEndpointClient,
      parameterResolver: mockParameterResolver,
    });
  });

  describe("create", () => {
    it("should create instance with default dependencies", () => {
      const defaultService = ExternalActionUseCase.create();
      expect(defaultService).toBeInstanceOf(ExternalActionUseCase);
      expect(defaultService.endpointClient).toBeDefined();
      expect(defaultService.parameterResolver).toBeDefined();
    });

    it("should create instance with custom dependencies", () => {
      expect(service.endpointClient).toBe(mockEndpointClient);
      expect(service.parameterResolver).toBe(mockParameterResolver);
    });
  });

  describe("execute", () => {
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

      mockParameterResolver.extractEndpointParameters.mockResolvedValue(
        mockParams,
      );
      mockEndpointClient.callExternalEndpoint.mockResolvedValue(mockResponse);

      const result = await service.execute({
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

      mockParameterResolver.extractEndpointParameters.mockResolvedValue({});
      mockEndpointClient.callExternalEndpoint.mockRejectedValue(error);

      const result = await service.execute({
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

      mockParameterResolver.extractEndpointParameters.mockResolvedValue({});
      mockEndpointClient.callExternalEndpoint.mockResolvedValue(null);

      const result = await service.execute({
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

      mockParameterResolver.extractEndpointParameters.mockResolvedValue({});
      mockEndpointClient.callExternalEndpoint.mockResolvedValue(undefined);

      const result = await service.execute({
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

      const result = await service.execute({
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
        service.execute({
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

      const result = await service.execute({
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
        service.execute({
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

      const result = await service.execute({
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
        service.execute({
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

      mockParameterResolver.extractEndpointParameters.mockResolvedValue({});
      mockEndpointClient.callExternalEndpoint.mockRejectedValue(error);

      const result = await service.execute({
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

      mockParameterResolver.extractEndpointParameters.mockResolvedValue({});
      mockEndpointClient.callExternalEndpoint.mockRejectedValue(error);

      await expect(
        service.execute({
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

      mockParameterResolver.extractEndpointParameters.mockRejectedValue(error);

      const result = await service.execute({
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

      mockParameterResolver.extractEndpointParameters.mockResolvedValue({});
      mockEndpointClient.callExternalEndpoint.mockResolvedValue(mockResponse);

      const result = await service.execute({
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

      mockParameterResolver.extractEndpointParameters.mockResolvedValue({});
      mockEndpointClient.callExternalEndpoint.mockResolvedValue(mockResponse);

      const result = await service.execute({
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

      mockParameterResolver.extractEndpointParameters.mockResolvedValue({});
      mockEndpointClient.callExternalEndpoint.mockResolvedValue(mockResponse);

      const result = await service.execute({
        actionCode: "TEST_ACTION",
        caseWorkflowContext: mockCaseWorkflowContext,
      });

      expect(result).toEqual(mockResponse);
      expect(mockEndpointClient.callExternalEndpoint).toHaveBeenCalledWith(
        { code: "GET_ENDPOINT", method: "GET" },
        {},
        mockCaseWorkflowContext,
        false,
      );
    });
  });

  describe("validateAction", () => {
    it("should return action when valid", () => {
      const mockAction = {
        code: "TEST_ACTION",
        endpoint: { code: "TEST_ENDPOINT" },
      };
      const mockWorkflow = {
        findExternalAction: vi.fn().mockReturnValue(mockAction),
      };

      const result = service.validateAction("TEST_ACTION", mockWorkflow);

      expect(result).toEqual(mockAction);
      expect(mockWorkflow.findExternalAction).toHaveBeenCalledWith(
        "TEST_ACTION",
      );
    });

    it("should throw error when action not found", () => {
      const mockWorkflow = {
        findExternalAction: vi.fn().mockReturnValue(null),
      };

      expect(() =>
        service.validateAction("NON_EXISTENT_ACTION", mockWorkflow),
      ).toThrow("No endpoint defined for action: NON_EXISTENT_ACTION");
    });

    it("should throw error when action has no endpoint", () => {
      const mockAction = { code: "TEST_ACTION", endpoint: null };
      const mockWorkflow = {
        findExternalAction: vi.fn().mockReturnValue(mockAction),
      };

      expect(() => service.validateAction("TEST_ACTION", mockWorkflow)).toThrow(
        "No endpoint defined for action: TEST_ACTION",
      );
    });
  });

  describe("validateEndpoint", () => {
    it("should return endpoint when valid", () => {
      const mockEndpoint = { code: "TEST_ENDPOINT", method: "POST" };
      const mockWorkflow = {
        findEndpoint: vi.fn().mockReturnValue(mockEndpoint),
      };

      const result = service.validateEndpoint("TEST_ENDPOINT", mockWorkflow);

      expect(result).toEqual(mockEndpoint);
      expect(mockWorkflow.findEndpoint).toHaveBeenCalledWith("TEST_ENDPOINT");
    });

    it("should throw error when endpoint not found", () => {
      const mockWorkflow = {
        findEndpoint: vi.fn().mockReturnValue(null),
      };

      expect(() =>
        service.validateEndpoint("NON_EXISTENT_ENDPOINT", mockWorkflow),
      ).toThrow("Endpoint not found: NON_EXISTENT_ENDPOINT");
    });
  });

  describe("prepareParameters", () => {
    it("should extract and return parameters", async () => {
      const mockParams = { PATH: { id: "123" }, BODY: { data: "test" } };
      const mockCaseWorkflowContext = { workflow: {}, _id: "123" };

      mockParameterResolver.extractEndpointParameters.mockResolvedValue(
        mockParams,
      );

      const result = await service.prepareParameters({
        actionCode: "TEST_ACTION",
        caseWorkflowContext: mockCaseWorkflowContext,
      });

      expect(result).toEqual(mockParams);
      expect(
        mockParameterResolver.extractEndpointParameters,
      ).toHaveBeenCalledWith({
        actionCode: "TEST_ACTION",
        caseWorkflowContext: mockCaseWorkflowContext,
      });
    });
  });

  describe("callEndpoint", () => {
    it("should call external endpoint", async () => {
      const mockEndpoint = { code: "TEST_ENDPOINT", method: "POST" };
      const mockParams = { PATH: { id: "123" } };
      const mockContext = { _id: "123" };
      const mockResponse = { success: true };

      mockEndpointClient.callExternalEndpoint.mockResolvedValue(mockResponse);

      const result = await service.callEndpoint(
        mockEndpoint,
        mockParams,
        mockContext,
        false,
      );

      expect(result).toEqual(mockResponse);
      expect(mockEndpointClient.callExternalEndpoint).toHaveBeenCalledWith(
        mockEndpoint,
        mockParams,
        mockContext,
        false,
      );
    });
  });

  describe("processResponse", () => {
    it("should return response when valid", () => {
      const mockResponse = { data: "test" };

      const result = service.processResponse(mockResponse);

      expect(result).toEqual(mockResponse);
    });

    it("should return empty object when response is null", () => {
      const result = service.processResponse(null);

      expect(result).toEqual({});
    });

    it("should return empty object when response is undefined", () => {
      const result = service.processResponse(undefined);

      expect(result).toEqual({});
    });
  });

  describe("handleError", () => {
    it("should return empty object when throwOnError is false", () => {
      const mockError = new Error("Test error");

      const result = service.handleError(mockError, "TEST_ACTION", false);

      expect(result).toEqual({});
    });

    it("should throw error when throwOnError is true", () => {
      const mockError = new Error("Test error");

      expect(() => service.handleError(mockError, "TEST_ACTION", true)).toThrow(
        mockError,
      );
    });
  });
});
