import { describe, expect, it } from "vitest";
import { FetchStatus } from "../../common/fetch-status.js";
import { ConfigVersion } from "./config-version.js";

describe("ConfigVersion", () => {
  describe("constructor", () => {
    it("should create a valid config version", () => {
      const cv = ConfigVersion.createMock();
      expect(cv.grantCode).toBe("pigs-might-fly");
      expect(cv.version).toBe("1.0.0");
      expect(cv.fetchStatus).toBe(FetchStatus.Pending);
    });

    it("should throw on missing required fields", () => {
      expect(() => new ConfigVersion({})).toThrow("Invalid ConfigVersion");
    });

    it("should default fetchStatus to pending", () => {
      const cv = ConfigVersion.createMock();
      expect(cv.fetchStatus).toBe(FetchStatus.Pending);
      expect(cv.fetchAttempts).toBe(0);
      expect(cv.fetchedAt).toBeNull();
      expect(cv.fetchError).toBeNull();
    });
  });

  describe("new", () => {
    it("should parse semver and create config version", () => {
      const cv = ConfigVersion.new({
        grantCode: "woodland",
        version: "2.3.4",
        status: "active",
        s3Key: "woodland/2.3.4/workflow-definition.json",
        s3Bucket: "config-broker-local",
      });

      expect(cv.major).toBe(2);
      expect(cv.minor).toBe(3);
      expect(cv.patch).toBe(4);
    });

    it("should throw on invalid semver", () => {
      expect(() =>
        ConfigVersion.new({
          grantCode: "woodland",
          version: "not-semver",
          status: "active",
          s3Key: "key",
          s3Bucket: "bucket",
        }),
      ).toThrow("Invalid semver version");
    });
  });

  describe("fromDocument", () => {
    it("should return null for null doc", () => {
      expect(ConfigVersion.fromDocument(null)).toBeNull();
    });

    it("should hydrate from a document", () => {
      const doc = ConfigVersion.createMock().toDocument();
      doc.grantCode = "test-grant";
      const cv = ConfigVersion.fromDocument(doc);
      expect(cv.grantCode).toBe("test-grant");
    });
  });

  describe("toDocument", () => {
    it("should serialize all fields", () => {
      const cv = ConfigVersion.createMock();
      const doc = cv.toDocument();

      expect(doc.grantCode).toBe("pigs-might-fly");
      expect(doc.version).toBe("1.0.0");
      expect(doc.major).toBe(1);
      expect(doc.minor).toBe(0);
      expect(doc.patch).toBe(0);
      expect(doc.status).toBe("active");
      expect(doc.s3Key).toBe("pigs-might-fly/1.0.0/workflow-definition.json");
      expect(doc.s3Bucket).toBe("config-broker-local");
      expect(doc.fetchStatus).toBe(FetchStatus.Pending);
      expect(doc.fetchAttempts).toBe(0);
    });
  });

  describe("createMock", () => {
    it("should allow overrides", () => {
      const cv = ConfigVersion.createMock({
        fetchStatus: FetchStatus.Fetched,
        fetchAttempts: 3,
      });
      expect(cv.fetchStatus).toBe(FetchStatus.Fetched);
      expect(cv.fetchAttempts).toBe(3);
    });
  });
});
