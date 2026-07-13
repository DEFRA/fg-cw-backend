import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEndpoint } from "./endpoint-resolver.js";
import { buildUrl, callExternalEndpoint } from "./external-endpoint-client.js";
import { logger } from "./logger.js";
import { wreck } from "./wreck.js";

vi.mock("./logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("./endpoint-resolver.js", () => ({
  resolveEndpoint: vi.fn(),
}));
vi.mock("./wreck.js", () => ({
  wreck: {
    request: vi.fn(),
    read: vi.fn(),
  },
}));

describe("external-endpoint-client", () => {
  describe("buildUrl", () => {
    it.each([
      {
        baseUrl: "https://api.example.com",
        pathTemplate: "/api/runs/{runId}",
        pathParams: { runId: 123 },
        expected: "https://api.example.com/api/runs/123",
        description: "build URL with path parameters",
      },
      {
        baseUrl: "https://api.example.com",
        pathTemplate: "/api/{resource}/{id}/details",
        pathParams: { resource: "cases", id: 456 },
        expected: "https://api.example.com/api/cases/456/details",
        description: "handle multiple path parameters",
      },
      {
        baseUrl: "https://api.example.com",
        pathTemplate: "/api/search/{query}",
        pathParams: { query: "hello world" },
        expected: "https://api.example.com/api/search/hello%20world",
        description: "encode special characters in parameters",
      },
      {
        baseUrl: "https://api.example.com/",
        pathTemplate: "/api/runs/{runId}",
        pathParams: { runId: 123 },
        expected: "https://api.example.com/api/runs/123",
        description: "handle trailing slash in base URL",
      },
      {
        baseUrl: "https://api.example.com",
        pathTemplate: "api/runs/{runId}",
        pathParams: { runId: 123 },
        expected: "https://api.example.com/api/runs/123",
        description: "handle path without leading slash",
      },
      {
        baseUrl: "https://api.example.com",
        pathTemplate: "/api/runs",
        pathParams: {},
        expected: "https://api.example.com/api/runs",
        description: "handle empty path parameters",
      },
      {
        baseUrl: "https://api.example.com",
        pathTemplate: "/api/runs/{runId}",
        pathParams: { runId: 456 },
        expected: "https://api.example.com/api/runs/456",
        description: "convert non-string parameter to string",
      },
      {
        baseUrl: "https://api.example.com",
        pathTemplate: "/api/flag/{enabled}",
        pathParams: { enabled: true },
        expected: "https://api.example.com/api/flag/true",
        description: "handle boolean path parameter",
      },
    ])(
      "should $description",
      ({ baseUrl, pathTemplate, pathParams, expected }) => {
        const result = buildUrl(baseUrl, pathTemplate, pathParams);
        expect(result).toBe(expected);
      },
    );

    it.each([
      {
        pathParams: { runId: null },
        error: "Path parameter 'runId' is required but was null",
        description: "null",
      },
      {
        pathParams: { runId: undefined },
        error: "Path parameter 'runId' is required but was undefined",
        description: "undefined",
      },
      {
        pathParams: { runId: "" },
        error: "Path parameter 'runId' is required but was empty",
        description: "empty string",
      },
    ])(
      "should throw error for $description path parameter",
      ({ pathParams, error }) => {
        const baseUrl = "https://api.example.com";
        const pathTemplate = "/api/runs/{runId}";

        expect(() => {
          buildUrl(baseUrl, pathTemplate, pathParams);
        }).toThrow(error);
      },
    );
  });

  describe("callExternalEndpoint", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call external endpoint with GET request", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: { "x-api-key": "test-key" },
      });

      const mockResponse = { statusCode: 200 };
      const mockPayload = { data: "test-data" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "FETCH_RULES_ENDPOINT",
        service: "RULES_ENGINE",
        path: "/api/runs/{runId}",
        method: "GET",
      };

      const params = {
        PATH: { runId: 123 },
        BODY: {},
      };

      const result = await callExternalEndpoint(endpoint, params);

      expect(result).toEqual(mockPayload);
      expect(wreck.request).toHaveBeenCalledWith(
        "GET",
        "https://api.example.com/api/runs/123",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-api-key": "test-key",
          }),
          json: true,
        }),
      );
    });

    it.each([
      {
        method: "POST",
        endpointCode: "CREATE_RESOURCE",
        path: "/api/resources",
        params: { BODY: { name: "test", value: 42 } },
        expectedPayload: { name: "test", value: 42 },
        description: "POST request and body",
      },
      {
        method: "PUT",
        endpointCode: "UPDATE_RESOURCE",
        path: "/api/resources/{id}",
        params: { PATH: { id: 123 }, BODY: { name: "updated" } },
        expectedPayload: { name: "updated" },
        description: "PUT request and body",
      },
      {
        method: "PATCH",
        endpointCode: "PATCH_RESOURCE",
        path: "/api/resources/{id}",
        params: { PATH: { id: 123 }, BODY: { status: "active" } },
        expectedPayload: { status: "active" },
        description: "PATCH request and body",
      },
    ])(
      "should handle $description",
      async ({ method, endpointCode, path, params, expectedPayload }) => {
        resolveEndpoint.mockReturnValue({
          url: "https://api.example.com",
          headers: { Authorization: "Bearer token" },
        });

        const mockResponse = { statusCode: 200 };
        const mockPayload = { id: 123, status: "ok" };

        wreck.request.mockResolvedValue(mockResponse);
        wreck.read.mockResolvedValue(mockPayload);

        const endpoint = {
          code: endpointCode,
          service: "RULES_ENGINE",
          path,
          method,
        };

        const result = await callExternalEndpoint(endpoint, params);

        expect(result).toEqual(mockPayload);
        expect(wreck.request).toHaveBeenCalledWith(
          method,
          expect.stringContaining("https://api.example.com/api/resources"),
          expect.objectContaining({
            payload: expectedPayload,
          }),
        );
      },
    );

    it("should return null on error", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const error = new Error("Network error");
      wreck.request.mockRejectedValue(error);

      const endpoint = {
        code: "FETCH_RULES_ENDPOINT",
        service: "RULES_ENGINE",
        path: "/api/runs/{runId}",
        method: "GET",
      };

      const params = {
        PATH: { runId: 123 },
      };

      const result = await callExternalEndpoint(endpoint, params);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          endpoint: "FETCH_RULES_ENDPOINT",
        }),
        expect.stringContaining("Failed to call external endpoint"),
      );
    });

    it("should handle empty params gracefully", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const mockResponse = { statusCode: 200 };
      const mockPayload = { data: "test" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "LIST_RESOURCES",
        service: "RULES_ENGINE",
        path: "/api/resources",
        method: "GET",
      };

      const result = await callExternalEndpoint(endpoint);

      expect(result).toEqual(mockPayload);
      expect(wreck.request).toHaveBeenCalledWith(
        "GET",
        "https://api.example.com/api/resources",
        expect.any(Object),
      );
    });

    it("should throw error when throwOnError=true and request fails", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const error = new Error("Connection timeout");
      wreck.request.mockRejectedValue(error);

      const endpoint = {
        code: "FETCH_RULES_ENDPOINT",
        service: "RULES_ENGINE",
        path: "/api/runs/{runId}",
        method: "GET",
      };

      const params = {
        PATH: { runId: 123 },
      };

      await expect(
        callExternalEndpoint(endpoint, params, {}, true),
      ).rejects.toThrow(Boom.badGateway().constructor);
    });

    it("should return null for non-success status code", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const mockResponse = { statusCode: 404 };
      const mockPayload = { error: "Not found" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "FETCH_RULES_ENDPOINT",
        service: "RULES_ENGINE",
        path: "/api/runs/{runId}",
        method: "GET",
      };

      const params = {
        PATH: { runId: 999 },
      };

      const result = await callExternalEndpoint(endpoint, params);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "FETCH_RULES_ENDPOINT",
          statusCode: 404,
          responseBody: mockPayload,
        }),
        expect.stringContaining("non-success status"),
      );
    });

    it("should throw error when throwOnError=true and non-success status", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const mockResponse = { statusCode: 500 };
      const mockPayload = { error: "Internal server error" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "CREATE_RESOURCE",
        service: "RULES_ENGINE",
        path: "/api/resources",
        method: "POST",
      };

      const params = {
        BODY: { name: "test" },
      };

      await expect(
        callExternalEndpoint(endpoint, params, {}, true),
      ).rejects.toThrow(Boom.badGateway().constructor);
    });

    it("should handle DELETE request", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const mockResponse = { statusCode: 204 };
      const mockPayload = null;

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "DELETE_RESOURCE",
        service: "RULES_ENGINE",
        path: "/api/resources/{id}",
        method: "DELETE",
      };

      const params = {
        PATH: { id: 123 },
      };

      const result = await callExternalEndpoint(endpoint, params);

      expect(result).toEqual(mockPayload);
      expect(wreck.request).toHaveBeenCalledWith(
        "DELETE",
        "https://api.example.com/api/resources/123",
        expect.any(Object),
      );
    });

    it("should handle HEAD request", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const mockResponse = { statusCode: 200 };
      const mockPayload = {};

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "CHECK_RESOURCE",
        service: "RULES_ENGINE",
        path: "/api/resources/{id}",
        method: "HEAD",
      };

      const params = {
        PATH: { id: 123 },
        BODY: { shouldNotBeIncluded: true },
      };

      const result = await callExternalEndpoint(endpoint, params);

      expect(result).toEqual(mockPayload);
      const callArgs = wreck.request.mock.calls[0][2];
      expect(callArgs.payload).toBeUndefined();
    });

    it("should not include payload for GET with empty body", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const mockResponse = { statusCode: 200 };
      const mockPayload = { data: "test" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "GET_RESOURCE",
        service: "RULES_ENGINE",
        path: "/api/resources",
        method: "GET",
      };

      const params = {
        BODY: {},
      };

      await callExternalEndpoint(endpoint, params);

      const callArgs = wreck.request.mock.calls[0][2];
      expect(callArgs.payload).toBeUndefined();
    });

    it.each([
      { statusCode: 200 },
      { statusCode: 201 },
      { statusCode: 202 },
      { statusCode: 204 },
      { statusCode: 299 },
    ])(
      "should handle $statusCode status code as success",
      async ({ statusCode }) => {
        resolveEndpoint.mockReturnValue({
          url: "https://api.example.com",
          headers: {},
        });

        const mockResponse = { statusCode };
        const mockPayload = { status: "ok" };

        wreck.request.mockResolvedValue(mockResponse);
        wreck.read.mockResolvedValue(mockPayload);

        const endpoint = {
          code: "TEST_ENDPOINT",
          service: "TEST",
          path: "/api/test",
          method: "GET",
        };

        const result = await callExternalEndpoint(endpoint);

        expect(result).toEqual(mockPayload);
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            endpoint: "TEST_ENDPOINT",
            statusCode,
          }),
          expect.stringContaining("successful"),
        );
      },
    );

    it.each([
      { statusCode: 300 },
      { statusCode: 301 },
      { statusCode: 400 },
      { statusCode: 401 },
      { statusCode: 403 },
      { statusCode: 404 },
      { statusCode: 500 },
      { statusCode: 502 },
      { statusCode: 503 },
    ])(
      "should handle $statusCode status code as non-success",
      async ({ statusCode }) => {
        resolveEndpoint.mockReturnValue({
          url: "https://api.example.com",
          headers: {},
        });

        const mockResponse = { statusCode };
        const mockPayload = { error: "error" };

        wreck.request.mockResolvedValue(mockResponse);
        wreck.read.mockResolvedValue(mockPayload);

        const endpoint = {
          code: "TEST_ENDPOINT",
          service: "TEST",
          path: "/api/test",
          method: "GET",
        };

        const result = await callExternalEndpoint(endpoint);

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            endpoint: "TEST_ENDPOINT",
            statusCode,
          }),
          expect.stringContaining("non-success status"),
        );
      },
    );

    it("should pass caseWorkflowContext to resolveEndpoint", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const mockResponse = { statusCode: 200 };
      const mockPayload = { data: "test" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "TEST_ENDPOINT",
        service: "TEST",
        path: "/api/test",
        method: "GET",
      };

      const caseWorkflowContext = {
        caseId: "123",
        workflowId: "456",
      };

      await callExternalEndpoint(endpoint, {}, caseWorkflowContext);

      expect(resolveEndpoint).toHaveBeenCalledWith(
        endpoint,
        caseWorkflowContext,
      );
    });

    it("should log request details before execution", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: { "x-custom": "header" },
      });

      const mockResponse = { statusCode: 200 };
      const mockPayload = { data: "test" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "TEST_ENDPOINT",
        service: "TEST",
        path: "/api/test/{id}",
        method: "POST",
      };

      const params = {
        PATH: { id: 789 },
        BODY: { value: "test" },
      };

      await callExternalEndpoint(endpoint, params);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "TEST_ENDPOINT",
          method: "POST",
          url: "https://api.example.com/api/test/789",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-custom": "header",
          }),
        }),
        expect.stringContaining("Calling external endpoint"),
      );
    });

    it("should not include payload for POST with empty body", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const mockResponse = { statusCode: 200 };
      const mockPayload = { data: "test" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "POST_RESOURCE",
        service: "RULES_ENGINE",
        path: "/api/resources",
        method: "POST",
      };

      const params = {
        BODY: {},
      };

      await callExternalEndpoint(endpoint, params);

      const callArgs = wreck.request.mock.calls[0][2];
      expect(callArgs.payload).toBeUndefined();
    });

    it("should include payload for POST with non-empty body", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {},
      });

      const mockResponse = { statusCode: 201 };
      const mockPayload = { id: 123 };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "CREATE_RESOURCE",
        service: "RULES_ENGINE",
        path: "/api/resources",
        method: "POST",
      };

      const params = {
        BODY: { name: "test", count: 0 },
      };

      await callExternalEndpoint(endpoint, params);

      const callArgs = wreck.request.mock.calls[0][2];
      expect(callArgs.payload).toEqual({ name: "test", count: 0 });
    });

    it("should merge config headers with default headers", async () => {
      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: {
          Authorization: "Bearer token",
          "X-Custom-Header": "custom-value",
        },
      });

      const mockResponse = { statusCode: 200 };
      const mockPayload = { data: "test" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "TEST_ENDPOINT",
        service: "TEST",
        path: "/api/test",
        method: "GET",
      };

      await callExternalEndpoint(endpoint);

      const callArgs = wreck.request.mock.calls[0][2];
      expect(callArgs.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer token",
        "X-Custom-Header": "custom-value",
      });
    });
  });
});
