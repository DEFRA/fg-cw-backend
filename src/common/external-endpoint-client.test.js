import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildUrl, callExternalEndpoint } from "./external-endpoint-client.js";
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
    it("should build URL with path parameters", () => {
      const baseUrl = "https://api.example.com";
      const pathTemplate = "/api/runs/{runId}";
      const pathParams = { runId: 123 };

      const result = buildUrl(baseUrl, pathTemplate, pathParams);

      expect(result).toBe("https://api.example.com/api/runs/123");
    });

    it("should handle multiple path parameters", () => {
      const baseUrl = "https://api.example.com";
      const pathTemplate = "/api/{resource}/{id}/details";
      const pathParams = { resource: "cases", id: 456 };

      const result = buildUrl(baseUrl, pathTemplate, pathParams);

      expect(result).toBe("https://api.example.com/api/cases/456/details");
    });

    it("should encode special characters in parameters", () => {
      const baseUrl = "https://api.example.com";
      const pathTemplate = "/api/search/{query}";
      const pathParams = { query: "hello world" };

      const result = buildUrl(baseUrl, pathTemplate, pathParams);

      expect(result).toBe("https://api.example.com/api/search/hello%20world");
    });

    it("should handle trailing slash in base URL", () => {
      const baseUrl = "https://api.example.com/";
      const pathTemplate = "/api/runs/{runId}";
      const pathParams = { runId: 123 };

      const result = buildUrl(baseUrl, pathTemplate, pathParams);

      expect(result).toBe("https://api.example.com/api/runs/123");
    });

    it("should handle path without leading slash", () => {
      const baseUrl = "https://api.example.com";
      const pathTemplate = "api/runs/{runId}";
      const pathParams = { runId: 123 };

      const result = buildUrl(baseUrl, pathTemplate, pathParams);

      expect(result).toBe("https://api.example.com/api/runs/123");
    });

    it("should handle empty path parameters", () => {
      const baseUrl = "https://api.example.com";
      const pathTemplate = "/api/runs";
      const pathParams = {};

      const result = buildUrl(baseUrl, pathTemplate, pathParams);

      expect(result).toBe("https://api.example.com/api/runs");
    });
  });

  describe("callExternalEndpoint", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call external endpoint with GET request", async () => {
      const { resolveEndpoint } = await import("./endpoint-resolver.js");

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

    it("should call external endpoint with POST request and body", async () => {
      const { resolveEndpoint } = await import("./endpoint-resolver.js");

      resolveEndpoint.mockReturnValue({
        url: "https://api.example.com",
        headers: { Authorization: "Bearer token" },
      });

      const mockResponse = { statusCode: 201 };
      const mockPayload = { id: 123, status: "created" };

      wreck.request.mockResolvedValue(mockResponse);
      wreck.read.mockResolvedValue(mockPayload);

      const endpoint = {
        code: "CREATE_RESOURCE",
        service: "RULES_ENGINE",
        path: "/api/resources",
        method: "POST",
      };

      const params = {
        PATH: {},
        BODY: { name: "test", value: 42 },
      };

      const result = await callExternalEndpoint(endpoint, params);

      expect(result).toEqual(mockPayload);
      expect(wreck.request).toHaveBeenCalledWith(
        "POST",
        "https://api.example.com/api/resources",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer token",
          }),
          json: true,
          payload: { name: "test", value: 42 },
        }),
      );
    });

    it("should return null on error", async () => {
      const { resolveEndpoint } = await import("./endpoint-resolver.js");
      const { logger } = await import("./logger.js");

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
      const { resolveEndpoint } = await import("./endpoint-resolver.js");

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
  });
});
