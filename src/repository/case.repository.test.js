import { describe, vi, expect, afterEach, it } from "vitest";
import Boom from "@hapi/boom";
import { caseRepository, collection } from "./case.repository.js";
import { MongoServerError, ObjectId } from "mongodb";
import { caseData1, caseData2 } from "../../test/fixtures/case.js";
import caseListResponse from "../../test/fixtures/case-list-response.json";
import { db } from "../common/helpers/db.js";

vi.mock("../common/helpers/db.js", () => ({
  db: {
    collection: vi.fn().mockReturnThis()
  }
}));

describe("caseRepository", () => {
  afterEach(() => {
    vi.resetAllMocks(); // Reset state and implementation of all mocks after each test
  });

  describe("insert", () => {
    it("should create a handlers and return it", async () => {
      const insertedId = "insertedId123";
      const insertOne = vi.fn().mockResolvedValueOnce({
        insertedId,
        acknowledged: true
      });

      db.collection.mockReturnValue({
        insertOne
      });

      await caseRepository.insert(caseData1);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(insertOne).toHaveBeenCalledWith(caseData1);
    });

    it("should throw conflict error if handlers with id already exists", async () => {
      const error = new MongoServerError({ message: "Duplicate key error" });
      error.code = 11000; // Duplicate key error code

      db.collection.mockReturnValue({
        insertOne: vi.fn().mockRejectedValueOnce(error)
      });

      const promise = caseRepository.insert(caseData1);

      await expect(promise).rejects.toThrow(
        Boom.conflict(
          `Case with workflow code: '${caseData1.workflowCode}' and case ref: '${caseData1.caseRef}' already exists`
        )
      );
    });

    it("should throw internal error on other MongoDB errors", async () => {
      const error = new Error("Unexpected error");

      db.collection.mockReturnValue({
        insertOne: vi.fn().mockRejectedValueOnce(error)
      });

      const promise = caseRepository.insert(caseData1);

      await expect(promise).rejects.toThrow(Boom.internal(error));
    });

    it("should throw internal error if result is not acknowledged", async () => {
      const error = new Error("Error creating handlers");

      db.collection.mockReturnValue({
        insertOne: vi.fn().mockResolvedValue({ acknowledged: false })
      });

      const promise = caseRepository.insert(caseData1);
      await expect(promise).rejects.toThrow(Boom.internal(error));
    });
  });

  describe("findCases", () => {
    it("should return a list of cases", async () => {
      const listQuery = { page: 1, pageSize: 10 };
      const cases = [caseData1, caseData2];

      const mockEstimatedCount = vi.fn().mockResolvedValue(2);

      const mockFind = vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(cases)
      });

      db.collection.mockReturnValue({
        find: mockFind,
        estimatedDocumentCount: mockEstimatedCount
      });

      const result = await caseRepository.findCases(listQuery);

      console.log("result: ", result);
      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(mockFind).toHaveBeenCalled();
      expect(mockEstimatedCount).toHaveBeenCalled();
      expect(result).toEqual(caseListResponse);
    });
  });

  describe("findOne", () => {
    it("should return a specific handlers by id", async () => {
      const caseId = "6800c9feb76f8f854ebf901a";
      const findOne = vi.fn().mockResolvedValueOnce(caseData2);

      db.collection.mockReturnValue({
        findOne
      });
      // db.findOne.mockResolvedValue(caseData2);

      const result = await caseRepository.findOne(caseId);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(findOne).toHaveBeenCalledWith({ _id: new ObjectId(caseId) });
      expect(result).toEqual(caseData2);
    });

    it("should return null if handlers is not found", async () => {
      const caseId = "6800c9feb76f8f854ebf901a";

      const findOne = vi.fn().mockResolvedValueOnce(null);

      db.collection.mockReturnValue({
        findOne
      });

      const result = await caseRepository.findOne(caseId, db);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(findOne).toHaveBeenCalledWith({ _id: new ObjectId(caseId) });
      expect(result).toBeNull();
    });
  });
});
