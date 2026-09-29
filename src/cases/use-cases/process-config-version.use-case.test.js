import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../common/logger.js";
import { S3FetchError } from "../../common/s3-client.js";
import { isRetryableFailure } from "../../events/retryable.js";
import { Workflow } from "../models/workflow.js";
import { processConfigVersionUseCase } from "./process-config-version.use-case.js";

const { mockConfigGet } = vi.hoisted(() => {
  const defaults = {
    cdpEnvironment: "dev",
    "configBroker.variant": "",
  };
  const overrides = {};
  const mockConfigGet = vi.fn((key) =>
    key in overrides ? overrides[key] : defaults[key],
  );
  mockConfigGet._overrides = overrides;
  return { mockConfigGet };
});

vi.mock("../../common/config.js", () => ({
  config: { get: mockConfigGet },
}));

vi.mock("../../common/mongo-client.js", () => ({ db: {}, mongoClient: {} }));

vi.mock("../../common/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const { fetchConfigFile } = vi.hoisted(() => ({
  fetchConfigFile: vi.fn(),
}));

vi.mock("../../common/s3-client.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchConfigFile,
}));

const { upsert } = vi.hoisted(() => ({
  upsert: vi.fn(),
}));

vi.mock("../repositories/config-version.repository.js", () => ({
  upsert,
}));

const BUCKET = "test-grants-config-6bf3a";

const definitionFor = (code) => {
  const { _id, version, ...definition } = JSON.parse(
    JSON.stringify(Workflow.createMock({ code })),
  );

  return definition;
};

const messageFor = (data) => ({
  event: {
    data: {
      grantCode: "woodland",
      version: "1.2.3",
      status: "active",
      s3Bucket: BUCKET,
      manifest: ["woodland/1.2.3/cw/cw.json", "woodland/1.2.3/metadata.json"],
      ...data,
    },
  },
});

const failureOf = async (data, message = messageFor(data)) => {
  try {
    await processConfigVersionUseCase(message);
  } catch (error) {
    return error;
  }

  throw new Error("expected processConfigVersionUseCase to throw");
};

describe("processConfigVersionUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockConfigGet._overrides).forEach(
      (k) => delete mockConfigGet._overrides[k],
    );
    upsert.mockResolvedValue({ upsertedCount: 1 });
    fetchConfigFile.mockResolvedValue(definitionFor("woodland"));
  });

  it("fetches cw.json from the message's bucket and records the version", async () => {
    await processConfigVersionUseCase(messageFor());

    expect(fetchConfigFile).toHaveBeenCalledWith(
      BUCKET,
      "woodland/1.2.3/cw/cw.json",
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      grantCode: "woodland",
      version: "1.2.3",
      major: 1,
      minor: 2,
      patch: 3,
      status: "active",
      s3Bucket: BUCKET,
      s3Key: "woodland/1.2.3/cw/cw.json",
    });
  });

  it("accepts a draft version", async () => {
    await processConfigVersionUseCase(messageFor({ status: "draft" }));

    expect(upsert.mock.calls[0][0].status).toBe("draft");
  });

  // The broker publishes farm-payments again under its alias
  // frps-private-beta, with the same manifest; cw.json's code is the alias.
  it("records the aliased release under the message's grant", async () => {
    fetchConfigFile.mockResolvedValue(definitionFor("frps-private-beta"));

    await expect(
      processConfigVersionUseCase(
        messageFor({
          grantCode: "farm-payments",
          version: "1.2.6",
          manifest: [
            "farm-payments/1.2.6/cw/cw.json",
            "farm-payments/1.2.6/metadata.json",
          ],
        }),
      ),
    ).resolves.toBeUndefined();

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      grantCode: "farm-payments",
      version: "1.2.6",
      s3Key: "farm-payments/1.2.6/cw/cw.json",
    });
  });

  describe("failures retrying cannot fix", () => {
    it.each([
      ["no grant", { grantCode: undefined }, "missing required fields"],
      ["no version", { version: undefined }, "missing required fields"],
      ["no bucket", { s3Bucket: undefined }, "has no bucket"],
      ["an unknown status", { status: "withdrawn" }, "invalid status"],
      ["no manifest", { manifest: undefined }, "manifest"],
      ["an empty manifest", { manifest: [] }, "manifest"],
      ["a version that is not semver", { version: "1.2" }, "Invalid semver"],
      [
        "a manifest without cw.json",
        { manifest: ["woodland/1.2.3/metadata.json"] },
        "does not contain a cw config file",
      ],
    ])("dead-letters a message with %s", async (_, data, reason) => {
      const error = await failureOf(data);

      expect(error.message).toContain(reason);
      expect(isRetryableFailure(error)).toBe(false);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("never falls back to a bucket of its own when the message has none", async () => {
      await failureOf({ s3Bucket: undefined });

      expect(fetchConfigFile).not.toHaveBeenCalled();
    });

    it.each([
      ["missing", { statusCode: 404, code: "NoSuchKey" }],
      ["forbidden", { statusCode: 403, code: "AccessDenied" }],
      ["not valid JSON", { statusCode: 200, code: "PARSE_ERROR" }],
    ])("dead-letters a cw.json that is %s", async (_, props) => {
      fetchConfigFile.mockRejectedValue(new S3FetchError("s3 says no", props));

      const error = await failureOf();

      expect(error).toBeInstanceOf(S3FetchError);
      expect(isRetryableFailure(error)).toBe(false);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("dead-letters a definition that fails the check", async () => {
      fetchConfigFile.mockResolvedValue({
        ...definitionFor("woodland"),
        phases: [],
      });

      const error = await failureOf();

      expect(error.message).toContain("has no initial position");
      expect(isRetryableFailure(error)).toBe(false);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("treats a TypeError as permanent", async () => {
      upsert.mockRejectedValue(new TypeError("x is not a function"));

      const error = await failureOf();

      expect(isRetryableFailure(error)).toBe(false);
    });

    it("logs an error naming the grant, the version and the reason", async () => {
      await failureOf({ s3Bucket: undefined });

      expect(logger.error).toHaveBeenCalledWith(
        {
          event: {
            action: "config-version-rejected",
            outcome: "failure",
            reference: "woodland@1.2.3",
            reason: expect.stringContaining("has no bucket"),
          },
        },
        expect.stringMatching(
          /^Config version woodland@1\.2\.3 rejected and dead-lettered: Error: .*has no bucket/,
        ),
      );
    });

    it("dead-letters an event whose data an operator removed", async () => {
      const error = await failureOf(undefined, { event: {} });

      expect(error.message).toContain("missing required fields");
      expect(isRetryableFailure(error)).toBe(false);
    });
  });

  describe("failures worth retrying", () => {
    it("retries an S3 service error", async () => {
      const s3Error = new S3FetchError("S3 service error", {
        statusCode: 503,
        code: "SERVICE_ERROR",
      });
      fetchConfigFile.mockRejectedValue(s3Error);

      const error = await failureOf();

      expect(error).toBe(s3Error);
      expect(isRetryableFailure(error)).toBe(true);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("retries a database error", async () => {
      const mongoError = Object.assign(new Error("connection reset"), {
        name: "MongoNetworkError",
      });
      upsert.mockRejectedValue(mongoError);

      const error = await failureOf();

      expect(error).toBe(mongoError);
      expect(isRetryableFailure(error)).toBe(true);
    });

    it("does not mistake a Boom thrown elsewhere for a transient fault", async () => {
      upsert.mockRejectedValue(Boom.badImplementation("bug"));

      const error = await failureOf();

      expect(isRetryableFailure(error)).toBe(false);
    });
  });

  describe("variant behaviour", () => {
    const variantManifest = [
      "woodland/1.2.3/cw/cw.json",
      "woodland/1.2.3/cw/cw.next.json",
    ];

    it("fetches and records the variant file when a variant is configured", async () => {
      mockConfigGet._overrides["configBroker.variant"] = "next";

      await processConfigVersionUseCase(
        messageFor({ manifest: variantManifest }),
      );

      expect(fetchConfigFile).toHaveBeenCalledWith(
        BUCKET,
        "woodland/1.2.3/cw/cw.next.json",
      );
      expect(upsert.mock.calls[0][0].s3Key).toBe(
        "woodland/1.2.3/cw/cw.next.json",
      );
    });

    it("uses cw.json when no variant is configured", async () => {
      await processConfigVersionUseCase(
        messageFor({ manifest: variantManifest }),
      );

      expect(upsert.mock.calls[0][0].s3Key).toBe("woodland/1.2.3/cw/cw.json");
    });

    it("ignores the variant in prod", async () => {
      mockConfigGet._overrides["configBroker.variant"] = "next";
      mockConfigGet._overrides.cdpEnvironment = "prod";

      await processConfigVersionUseCase(
        messageFor({ manifest: variantManifest }),
      );

      expect(upsert.mock.calls[0][0].s3Key).toBe("woodland/1.2.3/cw/cw.json");
    });
  });
});
