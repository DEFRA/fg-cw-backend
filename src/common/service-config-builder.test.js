import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildServiceConfigMap,
  toServiceAddress,
} from "./service-config-builder.js";

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

describe("toServiceAddress", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  const withEnv = (env) => {
    process.env = { ...originalEnv, ...env };
  };

  it("is null when the service has no URL configured", () => {
    withEnv({ LAND_DATA_URL: undefined });

    expect(toServiceAddress({ service: "LAND_DATA", path: "/x" })).toBeNull();
  });

  it("is null when the configured URL does not parse", () => {
    withEnv({ LAND_DATA_URL: "not a url" });

    expect(toServiceAddress({ service: "LAND_DATA", path: "/x" })).toBeNull();
  });

  it("keeps only the scheme, host and path, with path placeholders as written", () => {
    withEnv({ LAND_DATA_URL: "https://u:p@h:8443/base/?k=v#f" });

    expect(toServiceAddress({ service: "LAND_DATA", path: "/x/{sbi}" })).toBe(
      "https://h:8443/base/x/{sbi}",
    );
  });

  it.each([
    ["https://h/base/", "/x"],
    ["https://h/base", "x"],
  ])("joins %s and %s with one slash", (url, path) => {
    withEnv({ LAND_DATA_URL: url });

    expect(toServiceAddress({ service: "LAND_DATA", path })).toBe(
      "https://h/base/x",
    );
  });

  it("never reads the service's headers", () => {
    withEnv({
      LAND_DATA_URL: "https://h",
      LAND_DATA_HEADERS: "x-api-key: HEADER_SENTINEL",
    });

    expect(
      toServiceAddress({ service: "LAND_DATA", path: "/x" }),
    ).not.toContain("HEADER_SENTINEL");
  });
});
