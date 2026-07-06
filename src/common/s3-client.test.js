import { GetObjectCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { S3FetchError, buildS3Key, fetchConfigFile } from "./s3-client.js";

const { mockSend } = vi.hoisted(() => {
  const mockSend = vi.fn();
  return { mockSend };
});

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    S3Client: class {
      send = mockSend;
    },
  };
});

vi.mock("./config.js", () => ({
  config: {
    get: (key) => {
      const values = {
        "aws.region": "eu-west-2",
        "aws.endpointUrl": "http://localhost:4566",
      };
      return values[key];
    },
  },
}));

vi.mock("./logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("s3-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildS3Key", () => {
    it("should construct the S3 key from grant code and version", () => {
      expect(buildS3Key("woodland", "1.2.3")).toBe("woodland/1.2.3/cw/cw.json");
    });

    it("should handle codes with hyphens", () => {
      expect(buildS3Key("pigs-might-fly", "2.0.0")).toBe(
        "pigs-might-fly/2.0.0/cw/cw.json",
      );
    });
  });

  describe("fetchConfigFile", () => {
    const bucket = "config-broker-test";
    const key = "woodland/1.0.0/cw/cw.json";

    it("should return parsed JSON when the S3 object exists and is valid", async () => {
      const workflowDef = { code: "woodland", phases: [] };
      mockSend.mockResolvedValue({
        Body: { transformToString: () => JSON.stringify(workflowDef) },
      });

      const result = await fetchConfigFile(bucket, key);
      expect(result).toEqual(workflowDef);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });

    it("should throw S3FetchError with 404 when key does not exist", async () => {
      const err = new Error("NoSuchKey");
      err.name = "NoSuchKey";
      err.$metadata = { httpStatusCode: 404 };
      mockSend.mockRejectedValue(err);

      await expect(fetchConfigFile(bucket, key)).rejects.toThrow(S3FetchError);
      await expect(fetchConfigFile(bucket, key)).rejects.toMatchObject({
        statusCode: 404,
        code: "NoSuchKey",
        isPermanent: true,
      });
    });

    it("should throw S3FetchError with 403 when access is denied", async () => {
      const err = new Error("AccessDenied");
      err.name = "AccessDenied";
      err.$metadata = { httpStatusCode: 403 };
      mockSend.mockRejectedValue(err);

      await expect(fetchConfigFile(bucket, key)).rejects.toThrow(S3FetchError);
      await expect(fetchConfigFile(bucket, key)).rejects.toMatchObject({
        statusCode: 403,
        code: "AccessDenied",
        isPermanent: true,
      });
    });

    it("should throw S3FetchError with PARSE_ERROR when content is invalid JSON", async () => {
      mockSend.mockResolvedValue({
        Body: { transformToString: () => "not valid json {{{" },
      });

      await expect(fetchConfigFile(bucket, key)).rejects.toThrow(S3FetchError);
      await expect(fetchConfigFile(bucket, key)).rejects.toMatchObject({
        code: "PARSE_ERROR",
        isParseError: true,
      });
    });

    it("should throw S3FetchError with SERVICE_ERROR for 5xx errors", async () => {
      const err = new Error("Internal Server Error");
      err.$metadata = { httpStatusCode: 500 };
      mockSend.mockRejectedValue(err);

      await expect(fetchConfigFile(bucket, key)).rejects.toThrow(S3FetchError);
      await expect(fetchConfigFile(bucket, key)).rejects.toMatchObject({
        statusCode: 500,
        code: "SERVICE_ERROR",
        isPermanent: false,
      });
    });

    it("should throw S3FetchError with SERVICE_ERROR for timeouts", async () => {
      const err = new Error("TimeoutError");
      err.$metadata = {};
      mockSend.mockRejectedValue(err);

      await expect(fetchConfigFile(bucket, key)).rejects.toThrow(S3FetchError);
      await expect(fetchConfigFile(bucket, key)).rejects.toMatchObject({
        statusCode: 500,
        code: "SERVICE_ERROR",
        isPermanent: false,
      });
    });
  });
});
