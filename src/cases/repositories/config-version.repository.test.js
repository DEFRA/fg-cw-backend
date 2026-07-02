import { beforeEach, describe, expect, it, vi } from "vitest";
import { FetchStatus } from "../../common/fetch-status.js";
import { ConfigVersion } from "../models/config-version.js";
import {
  findByGrantCodeAndVersion,
  findLatestForMajor,
  updateFetchStatus,
  upsert,
} from "./config-version.repository.js";

const mockCollection = {
  updateOne: vi.fn(),
  findOne: vi.fn(),
};

vi.mock("../../common/mongo-client.js", () => ({
  db: {
    collection: () => mockCollection,
  },
}));

describe("config-version.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsert", () => {
    it("should upsert a config version with correct filter and update", async () => {
      mockCollection.updateOne.mockResolvedValue({ upsertedCount: 1 });

      const cv = ConfigVersion.createMock();
      await upsert(cv);

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { grantCode: "pigs-might-fly", version: "1.0.0" },
        expect.objectContaining({
          $set: expect.objectContaining({
            major: 1,
            minor: 0,
            patch: 0,
            fetchStatus: FetchStatus.Pending,
          }),
        }),
        { upsert: true },
      );
    });
  });

  describe("findLatestForMajor", () => {
    it("should return the latest active version within the major", async () => {
      const doc = ConfigVersion.createMock({ minor: 2, patch: 1 }).toDocument();
      mockCollection.findOne.mockResolvedValue(doc);

      const result = await findLatestForMajor("pigs-might-fly", 1);
      expect(result).toBeInstanceOf(ConfigVersion);
      expect(mockCollection.findOne).toHaveBeenCalledWith(
        {
          grantCode: "pigs-might-fly",
          major: 1,
          status: "active",
          fetchStatus: { $ne: FetchStatus.PermanentError },
        },
        { sort: { minor: -1, patch: -1 } },
      );
    });

    it("should return null when no match found", async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await findLatestForMajor("nonexistent", 1);
      expect(result).toBeNull();
    });
  });

  describe("updateFetchStatus", () => {
    it("should update fetch status and increment attempts", async () => {
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await updateFetchStatus(
        "pigs-might-fly",
        "1.0.0",
        FetchStatus.TransientError,
        "S3 timeout",
      );

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { grantCode: "pigs-might-fly", version: "1.0.0" },
        expect.objectContaining({
          $set: expect.objectContaining({
            fetchStatus: FetchStatus.TransientError,
            fetchError: "S3 timeout",
          }),
          $inc: { fetchAttempts: 1 },
        }),
      );
    });

    it("should set fetchedAt when status is fetched", async () => {
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await updateFetchStatus("pigs-might-fly", "1.0.0", FetchStatus.Fetched);

      const updateArg = mockCollection.updateOne.mock.calls[0][1];
      expect(updateArg.$set.fetchedAt).toBeDefined();
    });

    it("should not increment fetchAttempts when status is fetched", async () => {
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await updateFetchStatus("pigs-might-fly", "1.0.0", FetchStatus.Fetched);

      const updateArg = mockCollection.updateOne.mock.calls[0][1];
      expect(updateArg.$inc).toBeUndefined();
    });
  });

  describe("findByGrantCodeAndVersion", () => {
    it("should return config version for exact match", async () => {
      const doc = ConfigVersion.createMock().toDocument();
      mockCollection.findOne.mockResolvedValue(doc);

      const result = await findByGrantCodeAndVersion("pigs-might-fly", "1.0.0");
      expect(result).toBeInstanceOf(ConfigVersion);
    });

    it("should return null when not found", async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await findByGrantCodeAndVersion("nonexistent", "1.0.0");
      expect(result).toBeNull();
    });
  });
});
