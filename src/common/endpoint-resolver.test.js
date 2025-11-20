import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseHeaders,
  resolveEndpoint,
  resolveEnvVarReferences,
} from "./endpoint-resolver.js";

vi.mock("./config.js", () => ({
  config: {
    get: vi.fn(),
  },
}));

describe("endpoint-resolver", () => {
  describe("parseHeaders", () => {
    it("should parse comma-separated headers", () => {
      const headersString = "x-api-key: test-key,Authorization: Bearer token";
      const result = parseHeaders(headersString);

      expect(result).toEqual({
        "x-api-key": "test-key",
        Authorization: "Bearer token",
      });
    });

    it("should handle empty headers string", () => {
      const result = parseHeaders(null);
      expect(result).toEqual({});
    });

    it("should handle whitespace in headers", () => {
      const headersString =
        "  x-api-key:  test-key  ,  Authorization:  Bearer token  ";
      const result = parseHeaders(headersString);

      expect(result).toEqual({
        "x-api-key": "test-key",
        Authorization: "Bearer token",
      });
    });

    it("should throw error for invalid header format", () => {
      const headersString = "invalid-header-format";
      expect(() => parseHeaders(headersString)).toThrow(
        "Invalid header format",
      );
    });
  });

  describe("resolveEnvVarReferences", () => {
    beforeEach(() => {
      process.env.TEST_TOKEN = "secret-token-123";
      process.env.API_KEY = "my-api-key";
    });

    afterEach(() => {
      delete process.env.TEST_TOKEN;
      delete process.env.API_KEY;
    });

    it("should resolve single environment variable reference", () => {
      // eslint-disable-next-line no-template-curly-in-string
      const value = "${TEST_TOKEN}";
      const result = resolveEnvVarReferences(value);

      expect(result).toBe("secret-token-123");
    });

    it("should resolve environment variable in Bearer token", () => {
      // eslint-disable-next-line no-template-curly-in-string
      const value = "Bearer ${TEST_TOKEN}";
      const result = resolveEnvVarReferences(value);

      expect(result).toBe("Bearer secret-token-123");
    });

    it("should resolve multiple environment variables", () => {
      // eslint-disable-next-line no-template-curly-in-string
      const value = "${TEST_TOKEN}:${API_KEY}";
      const result = resolveEnvVarReferences(value);

      expect(result).toBe("secret-token-123:my-api-key");
    });

    it("should return value unchanged if no env var references", () => {
      const value = "static-value";
      const result = resolveEnvVarReferences(value);

      expect(result).toBe("static-value");
    });

    it("should throw error if environment variable is not defined", () => {
      // eslint-disable-next-line no-template-curly-in-string
      const value = "${UNDEFINED_VAR}";
      expect(() => resolveEnvVarReferences(value)).toThrow(
        "Environment variable UNDEFINED_VAR referenced in header but not defined",
      );
    });
  });

  describe("resolveEndpoint", () => {
    it("should resolve endpoint configuration", async () => {
      const { config } = await import("./config.js");

      config.get.mockImplementation((key) => {
        if (key === "externalServices.rulesEngine.url") {
          return "https://api.example.com";
        }
        if (key === "externalServices.rulesEngine.headers") {
          return "x-api-key: test-key";
        }
        return null;
      });

      const endpoint = {
        service: "RULES_ENGINE",
        code: "FETCH_RULES_ENDPOINT",
      };

      const caseWorkflowContext = {
        workflow: {
          endpoints: [
            {
              code: "FETCH_RULES_ENDPOINT",
              service: "RULES_ENGINE",
              path: "/api/rules",
              method: "GET",
            },
          ],
        },
      };

      const result = resolveEndpoint(endpoint, caseWorkflowContext);

      expect(result).toEqual({
        url: "https://api.example.com",
        headers: {
          "x-api-key": "test-key",
        },
      });
    });

    it("should throw error for unknown service", async () => {
      const endpoint = {
        service: "UNKNOWN_SERVICE",
        code: "SOME_ENDPOINT",
      };

      const caseWorkflowContext = {
        workflow: {
          endpoints: [
            {
              code: "FETCH_RULES_ENDPOINT",
              service: "RULES_ENGINE",
              path: "/api/rules",
              method: "GET",
            },
          ],
        },
      };

      expect(() => resolveEndpoint(endpoint, caseWorkflowContext)).toThrow(
        "Unknown external service: UNKNOWN_SERVICE",
      );
    });

    it("should throw error if URL is not configured", async () => {
      const { config } = await import("./config.js");

      config.get.mockImplementation((key) => {
        if (key === "externalServices.rulesEngine.url") {
          return null;
        }
        if (key === "externalServices.rulesEngine.headers") {
          return null;
        }
        return null;
      });

      const endpoint = {
        service: "RULES_ENGINE",
        code: "FETCH_RULES_ENDPOINT",
      };

      const caseWorkflowContext = {
        workflow: {
          endpoints: [
            {
              code: "FETCH_RULES_ENDPOINT",
              service: "RULES_ENGINE",
              path: "/api/rules",
              method: "GET",
            },
          ],
        },
      };

      expect(() => resolveEndpoint(endpoint, caseWorkflowContext)).toThrow(
        "No URL configured for service: RULES_ENGINE",
      );
    });

    it("should handle null headers", async () => {
      const { config } = await import("./config.js");

      config.get.mockImplementation((key) => {
        if (key === "externalServices.rulesEngine.url") {
          return "https://api.example.com";
        }
        if (key === "externalServices.rulesEngine.headers") {
          return null;
        }
        return null;
      });

      const endpoint = {
        service: "RULES_ENGINE",
        code: "FETCH_RULES_ENDPOINT",
      };

      const caseWorkflowContext = {
        workflow: {
          endpoints: [
            {
              code: "FETCH_RULES_ENDPOINT",
              service: "RULES_ENGINE",
              path: "/api/rules",
              method: "GET",
            },
          ],
        },
      };

      const result = resolveEndpoint(endpoint, caseWorkflowContext);

      expect(result).toEqual({
        url: "https://api.example.com",
        headers: {},
      });
    });
  });
});
