import { beforeEach, describe, expect, it, vi } from "vitest";
import { processConfigVersionUseCase } from "./process-config-version.use-case.js";

vi.mock("../../common/config.js", () => ({
  config: {
    get: (key) => {
      const values = {
        "configBroker.s3Bucket": "config-broker-local",
      };
      return values[key];
    },
  },
}));

vi.mock("../../common/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../common/s3-client.js", () => ({
  buildS3Key: vi.fn(
    (grantCode, version) => `${grantCode}/${version}/workflow-definition.json`,
  ),
}));

const { upsert } = vi.hoisted(() => ({
  upsert: vi.fn(),
}));

vi.mock("../repositories/config-version.repository.js", () => ({
  upsert,
}));

describe("processConfigVersionUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({ upsertedCount: 1 });
  });

  it("should upsert a config version with correct fields", async () => {
    await processConfigVersionUseCase({
      grantCode: "pigs-might-fly",
      version: "1.2.3",
      status: "active",
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    const cv = upsert.mock.calls[0][0];
    expect(cv.grantCode).toBe("pigs-might-fly");
    expect(cv.version).toBe("1.2.3");
    expect(cv.major).toBe(1);
    expect(cv.minor).toBe(2);
    expect(cv.patch).toBe(3);
    expect(cv.status).toBe("active");
    expect(cv.s3Bucket).toBe("config-broker-local");
    expect(cv.s3Key).toBe("pigs-might-fly/1.2.3/workflow-definition.json");
  });

  it("should accept draft status", async () => {
    await processConfigVersionUseCase({
      grantCode: "woodland",
      version: "2.0.0",
      status: "draft",
    });

    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("should throw on missing grantCode", async () => {
    await expect(
      processConfigVersionUseCase({
        version: "1.0.0",
        status: "active",
      }),
    ).rejects.toThrow("missing required fields");
  });

  it("should throw on missing version", async () => {
    await expect(
      processConfigVersionUseCase({
        grantCode: "woodland",
        status: "active",
      }),
    ).rejects.toThrow("missing required fields");
  });

  it("should throw on invalid status", async () => {
    await expect(
      processConfigVersionUseCase({
        grantCode: "woodland",
        version: "1.0.0",
        status: "invalid",
      }),
    ).rejects.toThrow("invalid status");
  });

  it("should throw on invalid semver", async () => {
    await expect(
      processConfigVersionUseCase({
        grantCode: "woodland",
        version: "not-semver",
        status: "active",
      }),
    ).rejects.toThrow("Invalid semver");
  });
});
