import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseHeaders,
  resolveEndpoint,
  resolveEnvVarReferences,
  stripOuterQuotes,
} from "./endpoint-resolver.js";

describe("endpoint-resolver", () => {
  describe("parseHeaders", () => {
    it.each([
      {
        headers: "x-api-key: test-key,Authorization: Bearer token",
        expected: { "x-api-key": "test-key", Authorization: "Bearer token" },
        description: "parse comma-separated headers",
      },
      {
        headers: "  x-api-key:  test-key  ,  Authorization:  Bearer token  ",
        expected: { "x-api-key": "test-key", Authorization: "Bearer token" },
        description: "handle whitespace in headers",
      },
      {
        headers: '"Authorization: Bearer token"',
        expected: { Authorization: "Bearer token" },
        description:
          "handle header strings with surrounding quotes (CDP format)",
      },
      {
        headers: '"x-api-key: test-key, Authorization: Bearer token"',
        expected: { "x-api-key": "test-key", Authorization: "Bearer token" },
        description: "handle multiple headers with surrounding quotes",
      },
      {
        headers: '  "Authorization: Bearer token"  ,  "x-api-key: test-key"  ',
        expected: { Authorization: "Bearer token", "x-api-key": "test-key" },
        description: "handle whitespace around quoted headers",
      },
      {
        headers: '"Authorization: Bearer token"',
        expected: { Authorization: "Bearer token" },
        description: "handle edge cases in stripOuterQuotes",
      },
    ])("should $description", ({ headers, expected }) => {
      expect(parseHeaders(headers)).toEqual(expected);
    });

    it.each([
      { val: null, expected: {}, description: "null" },
      { val: undefined, expected: {}, description: "undefined" },
      { val: "", expected: {}, description: "empty string" },
    ])("should handle $description headers string", ({ val, expected }) => {
      expect(parseHeaders(val)).toEqual(expected);
    });

    it("should throw error for invalid header format", () => {
      const headersString = "invalid-header-format";
      expect(() => parseHeaders(headersString)).toThrow(
        "Invalid header format",
      );
    });

    it.each([
      { val: null, expected: null, description: "null" },
      { val: undefined, expected: undefined, description: "undefined" },
      { val: 123, expected: 123, description: "non-string (number)" },
      { val: "", expected: "", description: "empty string" },
      { val: '"quoted"', expected: "quoted", description: "quoted string" },
      { val: "unquoted", expected: "unquoted", description: "unquoted string" },
    ])("stripOuterQuotes should handle $description", ({ val, expected }) => {
      expect(stripOuterQuotes(val)).toBe(expected);
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

    it.each([
      {
        // eslint-disable-next-line no-template-curly-in-string
        value: "${TEST_TOKEN}",
        expected: "secret-token-123",
        description: "single environment variable reference",
      },
      {
        // eslint-disable-next-line no-template-curly-in-string
        value: "Bearer ${TEST_TOKEN}",
        expected: "Bearer secret-token-123",
        description: "environment variable in Bearer token",
      },
      {
        // eslint-disable-next-line no-template-curly-in-string
        value: "${TEST_TOKEN}:${API_KEY}",
        expected: "secret-token-123:my-api-key",
        description: "multiple environment variables",
      },
      {
        value: "static-value",
        expected: "static-value",
        description: "value unchanged if no env var references",
      },
    ])("should resolve $description", ({ value, expected }) => {
      expect(resolveEnvVarReferences(value)).toBe(expected);
    });

    it("should throw error if environment variable is not defined", () => {
      // eslint-disable-next-line no-template-curly-in-string
      const value = "${UNDEFINED_VAR}";
      expect(() => resolveEnvVarReferences(value)).toThrow(
        "Environment variable UNDEFINED_VAR referenced in header but not defined",
      );
    });

    it.each([
      { val: null, description: "null" },
      { val: undefined, description: "undefined" },
      { val: 123, description: "number" },
      { val: {}, description: "object" },
    ])("should handle $description values", ({ val }) => {
      expect(resolveEnvVarReferences(val)).toBe(val);
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
