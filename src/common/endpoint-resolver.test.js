import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseHeaders,
  resolveEndpoint,
  resolveEnvVarReferences,
  stripOuterQuotes,
} from "./endpoint-resolver.js";

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

    it("should handle header strings with surrounding quotes (CDP format)", () => {
      const headersString = '"Authorization: Bearer token"';
      const result = parseHeaders(headersString);

      expect(result).toEqual({
        Authorization: "Bearer token",
      });
    });

    it("should handle multiple headers with surrounding quotes", () => {
      const headersString =
        '"x-api-key: test-key, Authorization: Bearer token"';
      const result = parseHeaders(headersString);

      expect(result).toEqual({
        "x-api-key": "test-key",
        Authorization: "Bearer token",
      });
    });

    it("should handle whitespace around quoted headers", () => {
      const headersString =
        '  "Authorization: Bearer token"  ,  "x-api-key: test-key"  ';
      const result = parseHeaders(headersString);

      expect(result).toEqual({
        Authorization: "Bearer token",
        "x-api-key": "test-key",
      });
    });

    it("should handle null and non-string values in stripOuterQuotes", () => {
      expect(parseHeaders(null)).toEqual({});
      expect(parseHeaders(undefined)).toEqual({});
      expect(parseHeaders("")).toEqual({});
    });

    it("should handle edge cases in stripOuterQuotes", () => {
      expect(parseHeaders('"Authorization: Bearer token"')).toEqual({
        Authorization: "Bearer token",
      });
    });

    it("should handle null and non-string values in stripQuotes", () => {
      expect(stripOuterQuotes(null)).toBe(null);
      expect(stripOuterQuotes(undefined)).toBe(undefined);
      expect(stripOuterQuotes(123)).toBe(123);
      expect(stripOuterQuotes("")).toBe("");
      expect(stripOuterQuotes('"quoted"')).toBe("quoted");
      expect(stripOuterQuotes("unquoted")).toBe("unquoted");
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

    it("should handle null and non-string values", () => {
      expect(resolveEnvVarReferences(null)).toBe(null);
      expect(resolveEnvVarReferences(undefined)).toBe(undefined);
      expect(resolveEnvVarReferences(123)).toBe(123);
      const testObj = {};
      expect(resolveEnvVarReferences(testObj)).toBe(testObj);
    });
  });

  describe("resolveEndpoint", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should resolve endpoint configuration", () => {
      process.env.RULES_ENGINE_URL = "https://api.example.com";
      process.env.RULES_ENGINE_HEADERS = "x-api-key: test-key";

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

    it("should throw error for unknown service", () => {
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

    it("should throw error if URL is not configured", () => {
      delete process.env.RULES_ENGINE_URL;
      delete process.env.RULES_ENGINE_HEADERS;

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

    it("should handle null headers", () => {
      process.env.RULES_ENGINE_URL = "https://api.example.com";
      delete process.env.RULES_ENGINE_HEADERS;

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
