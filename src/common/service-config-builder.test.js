import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildServiceConfigMap } from "./service-config-builder.js";

vi.mock("./config.js", () => ({
  config: {
    get: vi.fn(),
  },
}));

describe("service-config-builder", () => {
  const configValues = {
    "externalServices.rulesEngine.url": "https://rules.example.com",
    "externalServices.rulesEngine.headers": "x-api-key: rules-key",
    "externalServices.analytics.url": "https://analytics.example.com",
    "externalServices.analytics.headers": "Authorization: Bearer abc123",
  };

  beforeEach(async () => {
    const { config } = await import("./config.js");
    config.get.mockReset();
    config.get.mockImplementation((key) => configValues[key]);
  });

  it("builds config entries for unique services using camelCased config keys", async () => {
    const workflow = {
      endpoints: [
        { service: "RULES_ENGINE", code: "FETCH_RULES_ENDPOINT" },
        { service: "ANALYTICS", code: "SEND_TELEMETRY_ENDPOINT" },
        { service: "RULES_ENGINE", code: "SECOND_RULES_ENDPOINT" },
      ],
    };

    const result = buildServiceConfigMap(workflow);
    const { config } = await import("./config.js");

    expect(config.get).toHaveBeenCalledTimes(4);
    expect(config.get).toHaveBeenCalledWith("externalServices.rulesEngine.url");
    expect(config.get).toHaveBeenCalledWith(
      "externalServices.rulesEngine.headers",
    );
    expect(config.get).toHaveBeenCalledWith("externalServices.analytics.url");
    expect(config.get).toHaveBeenCalledWith(
      "externalServices.analytics.headers",
    );
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
