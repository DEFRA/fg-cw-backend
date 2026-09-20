import { afterEach, beforeEach, describe, expect, it } from "vitest";

const VARIANT_ENV_KEYS = ["CONFIGURATION_VARIANT", "ENVIRONMENT"];

const loadConfig = async () => {
  const { config } = await import("./config.js");
  return config;
};

describe("config configBroker.variant", () => {
  const saved = {};

  beforeEach(async () => {
    for (const key of VARIANT_ENV_KEYS) {
      saved[key] = process.env[key];
    }
    const { vi } = await import("vitest");
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of VARIANT_ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("defaults to empty string when CONFIGURATION_VARIANT is unset", async () => {
    delete process.env.CONFIGURATION_VARIANT;

    const cfg = await loadConfig();

    expect(cfg.get("configBroker.variant")).toBe("");
  });

  it("accepts a valid variant value", async () => {
    process.env.CONFIGURATION_VARIANT = "next";

    const cfg = await loadConfig();

    expect(cfg.get("configBroker.variant")).toBe("next");
  });

  it("accepts an empty string as a valid variant", async () => {
    process.env.CONFIGURATION_VARIANT = "";

    const cfg = await loadConfig();

    expect(cfg.get("configBroker.variant")).toBe("");
  });

  it("skips validation when ENVIRONMENT is prod", async () => {
    process.env.CONFIGURATION_VARIANT = "ANY_value";
    process.env.ENVIRONMENT = "prod";

    const cfg = await loadConfig();

    expect(cfg.get("configBroker.variant")).toBe("ANY_value");
  });

  it("throws for invalid variant characters in non-prod", async () => {
    process.env.CONFIGURATION_VARIANT = "BAD_value";
    process.env.ENVIRONMENT = "dev";

    await expect(loadConfig()).rejects.toThrow(
      "must be lowercase letters, numbers or hyphens",
    );
  });
});
