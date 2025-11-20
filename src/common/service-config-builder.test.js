import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServiceConfigMap } from "./service-config-builder.js";

describe("service-config-builder", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RULES_ENGINE_URL: "https://rules.example.com",
      RULES_ENGINE_HEADERS: "x-api-key: rules-key",
      ANALYTICS_URL: "https://analytics.example.com",
      ANALYTICS_HEADERS: "Authorization: Bearer abc123",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("builds config entries for unique services from environment variables", () => {
    const workflow = {
      endpoints: [
        { service: "RULES_ENGINE", code: "FETCH_RULES_ENDPOINT" },
        { service: "ANALYTICS", code: "SEND_TELEMETRY_ENDPOINT" },
        { service: "RULES_ENGINE", code: "SECOND_RULES_ENDPOINT" },
      ],
    };

    const result = buildServiceConfigMap(workflow);

    expect(result).toEqual({
      RULES_ENGINE: {
        url: "https://rules.example.com",
        headers: "x-api-key: rules-key",
      },
      ANALYTICS: {
        url: "https://analytics.example.com",
        headers: "Authorization: Bearer abc123",
      },
    });
  });

  it("returns null for url and headers when environment variables are not set", () => {
    delete process.env.RULES_ENGINE_URL;
    delete process.env.RULES_ENGINE_HEADERS;

    const workflow = {
      endpoints: [{ service: "RULES_ENGINE", code: "FETCH_RULES_ENDPOINT" }],
    };

    const result = buildServiceConfigMap(workflow);

    expect(result).toEqual({
      RULES_ENGINE: {
        url: null,
        headers: null,
      },
    });
  });

  it("returns empty map when workflow has no endpoints", () => {
    const result = buildServiceConfigMap({});

    expect(result).toEqual({});
  });

  it("ignores endpoints without a service name", () => {
    const workflow = {
      endpoints: [
        { code: "MISSING_SERVICE" },
        { service: undefined },
        { service: null },
      ],
    };

    const result = buildServiceConfigMap(workflow);
    expect(result).toEqual({});
  });
});
