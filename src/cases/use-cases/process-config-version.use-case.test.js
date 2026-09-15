import { beforeEach, describe, expect, it, vi } from "vitest";
import { processConfigVersionUseCase } from "./process-config-version.use-case.js";

const { mockConfigGet } = vi.hoisted(() => {
  const defaults = {
    "configBroker.s3Bucket": "config-broker-local",
    cdpEnvironment: "dev",
    "configBroker.variant": "",
  };
  const overrides = {};
  const mockConfigGet = vi.fn((key) =>
    key in overrides ? overrides[key] : defaults[key],
  );
  mockConfigGet._overrides = overrides;
  mockConfigGet._defaults = defaults;
  return { mockConfigGet };
});

vi.mock("../../common/config.js", () => ({
  config: { get: mockConfigGet },
}));

vi.mock("../../common/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const { mockFindS3Key } = vi.hoisted(() => ({
  mockFindS3Key: vi.fn((manifest, serviceKey, variant) => {
    const suffix = variant
      ? `/${serviceKey}/${serviceKey}.${variant}.json`
      : `/${serviceKey}/${serviceKey}.json`;
    return manifest.find((path) => path.endsWith(suffix));
  }),
}));

vi.mock("../../common/s3-client.js", () => ({
  findS3KeyInManifest: mockFindS3Key,
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
    Object.keys(mockConfigGet._overrides).forEach(
      (k) => delete mockConfigGet._overrides[k],
    );
    upsert.mockResolvedValue({ upsertedCount: 1 });
  });

  it("should upsert a config version with correct fields", async () => {
    await processConfigVersionUseCase({
      grantCode: "pigs-might-fly",
      version: "1.2.3",
      status: "active",
      manifest: [
        "pigs-might-fly/1.2.3/cw/cw.json",
        "pigs-might-fly/1.2.3/metadata.json",
      ],
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
    expect(cv.s3Key).toBe("pigs-might-fly/1.2.3/cw/cw.json");
  });

  it("should accept draft status", async () => {
    await processConfigVersionUseCase({
      grantCode: "woodland",
      version: "2.0.0",
      status: "draft",
      manifest: ["woodland/2.0.0/cw/cw.json"],
    });

    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("should throw on missing grantCode", async () => {
    await expect(
      processConfigVersionUseCase({
        version: "1.0.0",
        status: "active",
        manifest: ["woodland/1.0.0/cw/cw.json"],
      }),
    ).rejects.toThrow("missing required fields");
  });

  it("should throw on missing version", async () => {
    await expect(
      processConfigVersionUseCase({
        grantCode: "woodland",
        status: "active",
        manifest: ["woodland/1.0.0/cw/cw.json"],
      }),
    ).rejects.toThrow("missing required fields");
  });

  it("should throw on missing manifest", async () => {
    await expect(
      processConfigVersionUseCase({
        grantCode: "woodland",
        version: "1.0.0",
        status: "active",
      }),
    ).rejects.toThrow("manifest");
  });

  it("should throw on empty manifest", async () => {
    await expect(
      processConfigVersionUseCase({
        grantCode: "woodland",
        version: "1.0.0",
        status: "active",
        manifest: [],
      }),
    ).rejects.toThrow("manifest");
  });

  it("should throw on invalid status", async () => {
    await expect(
      processConfigVersionUseCase({
        grantCode: "woodland",
        version: "1.0.0",
        status: "invalid",
        manifest: ["woodland/1.0.0/cw/cw.json"],
      }),
    ).rejects.toThrow("invalid status");
  });

  it("should throw on invalid semver", async () => {
    await expect(
      processConfigVersionUseCase({
        grantCode: "woodland",
        version: "not-semver",
        status: "active",
        manifest: ["woodland/1.0.0/cw/cw.json"],
      }),
    ).rejects.toThrow("Invalid semver");
  });

  describe("variant behaviour", () => {
    it('should call findS3KeyInManifest with variant when getConfigurationVariant returns "next"', async () => {
      mockConfigGet._overrides["configBroker.variant"] = "next";

      await processConfigVersionUseCase({
        grantCode: "woodland",
        version: "1.0.0",
        status: "active",
        manifest: [
          "woodland/1.0.0/cw/cw.json",
          "woodland/1.0.0/cw/cw.next.json",
        ],
      });

      expect(mockFindS3Key).toHaveBeenCalledWith(
        expect.any(Array),
        "cw",
        "next",
      );
    });

    it("should call findS3KeyInManifest without a variant when getConfigurationVariant returns empty", async () => {
      await processConfigVersionUseCase({
        grantCode: "woodland",
        version: "1.0.0",
        status: "active",
        manifest: ["woodland/1.0.0/cw/cw.json"],
      });

      expect(mockFindS3Key).toHaveBeenCalledWith(
        expect.any(Array),
        "cw",
        "",
      );
    });

    it("should store the variant s3Key when variant file is selected", async () => {
      mockConfigGet._overrides["configBroker.variant"] = "next";

      await processConfigVersionUseCase({
        grantCode: "woodland",
        version: "1.0.0",
        status: "active",
        manifest: [
          "woodland/1.0.0/cw/cw.json",
          "woodland/1.0.0/cw/cw.next.json",
        ],
      });

      const cv = upsert.mock.calls[0][0];
      expect(cv.s3Key).toBe("woodland/1.0.0/cw/cw.next.json");
    });
  });
});
