import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("config events.retentionDays", () => {
  const saved = {};

  beforeEach(async () => {
    saved.EVENT_RETENTION_DAYS = process.env.EVENT_RETENTION_DAYS;
    const { vi } = await import("vitest");
    vi.resetModules();
  });

  afterEach(() => {
    if (saved.EVENT_RETENTION_DAYS === undefined) {
      delete process.env.EVENT_RETENTION_DAYS;
    } else {
      process.env.EVENT_RETENTION_DAYS = saved.EVENT_RETENTION_DAYS;
    }
  });

  it("defaults to 90 days when EVENT_RETENTION_DAYS is unset", async () => {
    delete process.env.EVENT_RETENTION_DAYS;

    const cfg = await loadConfig();

    expect(cfg.get("events.retentionDays")).toBe(90);
  });

  it("reads the environment as a number, not the string it arrived as", async () => {
    process.env.EVENT_RETENTION_DAYS = "120";

    const cfg = await loadConfig();

    expect(cfg.get("events.retentionDays")).toBe(120);
  });

  it("accepts the floor of 30", async () => {
    process.env.EVENT_RETENTION_DAYS = "30";

    const cfg = await loadConfig();

    expect(cfg.get("events.retentionDays")).toBe(30);
  });

  // 0 is the one convict's own `nat` would have let through.
  it.each(["0", "29", "-1", "abc", "30.5", ""])(
    "refuses to start on EVENT_RETENTION_DAYS=%s",
    async (value) => {
      process.env.EVENT_RETENTION_DAYS = value;

      await expect(loadConfig()).rejects.toThrow();
    },
  );
});

describe("config log.redact", () => {
  const saved = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = saved;
  });

  it("keeps both operator headers out of production logs", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    process.env.NODE_ENV = "production";

    const cfg = await loadConfig();

    expect(cfg.get("log.redact")).toEqual(
      expect.arrayContaining([
        'req.headers["x-actor"]',
        'req.headers["x-actor-id"]',
      ]),
    );
  });
});

describe("config metrics.enabled", () => {
  let saved;

  beforeEach(async () => {
    saved = process.env.METRICS_ENABLED;
    delete process.env.METRICS_ENABLED;
    const { vi } = await import("vitest");
    vi.resetModules();
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.METRICS_ENABLED;
    } else {
      process.env.METRICS_ENABLED = saved;
    }
  });

  it("is off when METRICS_ENABLED is unset", async () => {
    const cfg = await loadConfig();

    expect(cfg.get("metrics.enabled")).toBe(false);
  });

  it("is on when METRICS_ENABLED is true", async () => {
    process.env.METRICS_ENABLED = "true";

    const cfg = await loadConfig();

    expect(cfg.get("metrics.enabled")).toBe(true);
  });
});

// Tokens are managed only through the grants admin. A secret left set in an
// environment after the seeder went must not issue anything on boot.
describe("config service access token seeding", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SERVICE_ACCESS_TOKEN_HASH = `fg-gas-backend:${"a".repeat(64)}`;
  });

  afterEach(() => {
    delete process.env.SERVICE_ACCESS_TOKEN_HASH;
  });

  it("has no setting to seed a token from", async () => {
    const { config } = await import("./config.js");

    expect(() => config.get("serviceAccessTokenHash")).toThrow();
  });
});

describe("config search", () => {
  const INVENTED_KEY = "an-invented-search-audit-key-0001";

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("writes no digest key, reindexes every 30 seconds and sweeps 200 records every 30 seconds by default", async () => {
    vi.stubEnv("SEARCH_AUDIT_KEY", undefined);
    vi.stubEnv("SEARCH_REINDEX_INTERVAL_MS", undefined);
    vi.stubEnv("SEARCH_SWEEP_BATCH", undefined);
    vi.stubEnv("SEARCH_SWEEP_INTERVAL_MS", undefined);

    const cfg = await loadConfig();

    expect(cfg.get("search")).toEqual({
      auditKey: null,
      reindexIntervalMs: 30_000,
      sweepBatch: 200,
      sweepIntervalMs: 30_000,
    });
  });

  it("reads the digest key, the intervals and the sweep batch", async () => {
    vi.stubEnv("SEARCH_AUDIT_KEY", INVENTED_KEY);
    vi.stubEnv("SEARCH_REINDEX_INTERVAL_MS", "5000");
    vi.stubEnv("SEARCH_SWEEP_BATCH", "50");
    vi.stubEnv("SEARCH_SWEEP_INTERVAL_MS", "7000");

    const cfg = await loadConfig();

    expect(cfg.get("search")).toEqual({
      auditKey: INVENTED_KEY,
      reindexIntervalMs: 5000,
      sweepBatch: 50,
      sweepIntervalMs: 7000,
    });
  });

  it("keeps the digest key out of the printed config", async () => {
    vi.stubEnv("SEARCH_AUDIT_KEY", INVENTED_KEY);

    const cfg = await loadConfig();

    expect(cfg.toString()).not.toContain(INVENTED_KEY);
  });

  it.each(
    [
      "SEARCH_REINDEX_INTERVAL_MS",
      "SEARCH_SWEEP_BATCH",
      "SEARCH_SWEEP_INTERVAL_MS",
    ].flatMap((name) =>
      ["0", "-1", "abc", "1.5"].map((value) => [name, value]),
    ),
  )("refuses to start on %s=%s", async (name, value) => {
    vi.stubEnv(name, value);

    await expect(loadConfig()).rejects.toThrow();
  });

  it("refuses a digest key shorter than 32 characters", async () => {
    vi.stubEnv("SEARCH_AUDIT_KEY", "a".repeat(31));

    await expect(loadConfig()).rejects.toThrow(/search\.auditKey/);
  });
});
