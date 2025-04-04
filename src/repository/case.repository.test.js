import { describe, test, vi, expect, beforeEach } from "vitest";
import Boom from "@hapi/boom";
import { caseRepository, collection } from "./case.repository.js";
import { MongoServerError } from "mongodb";
import { caseData1, caseData2 } from "../../test/fixtures/case.js";

describe("caseRepository", () => {
  let db;

  beforeEach(() => {
    db = {
      collection: vi.fn().mockReturnThis(),
      insertOne: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn()
    };
  });

  describe("createCase", () => {
    test("should create a case and return it", async () => {
      const insertedId = "insertedId123";
      const expectedCase = { _id: insertedId, ...caseData1 };

      db.insertOne.mockResolvedValue({ acknowledged: true, insertedId });
      db.findOne.mockResolvedValue(expectedCase);

      const result = await caseRepository.createCase(caseData1, db);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.insertOne).toHaveBeenCalledWith(caseData1);
      expect(db.findOne).toHaveBeenCalledWith({ _id: insertedId });
      expect(result).toEqual(expectedCase);
    });

    test("should throw conflict error if case with id already exists", async () => {
      const error = new MongoServerError({ message: "Duplicate key error" });
      error.code = 11000; // Duplicate key error code

      db.insertOne.mockRejectedValue(error);

      await expect(caseRepository.createCase(caseData1, db)).rejects.toThrow(
        Boom.conflict(`Case with id: ${caseData1.id} already exists`)
      );

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.insertOne).toHaveBeenCalledWith(caseData1);
    });

    test("should throw internal error on other MongoDB errors", async () => {
      const error = new Error("Unexpected error");

      db.insertOne.mockRejectedValue(error);

      await expect(caseRepository.createCase(caseData1, db)).rejects.toThrow(
        Boom.internal(error)
      );

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.insertOne).toHaveBeenCalledWith(caseData1);
    });

    test("should throw internal error if result is not acknowledged", async () => {
      db.insertOne.mockResolvedValue({ acknowledged: false });

      await expect(caseRepository.createCase(caseData1, db)).rejects.toThrow(
        Boom.internal("Error creating case")
      );

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.insertOne).toHaveBeenCalledWith(caseData1);
    });
  });

  describe("findCases", () => {
    test("should return a list of cases", async () => {
      const cases = [caseData1, caseData2];

      db.toArray.mockResolvedValue(cases);

      const result = await caseRepository.findCases(db);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.find).toHaveBeenCalled();
      expect(db.toArray).toHaveBeenCalled();
      expect(result).toEqual(cases);
    });
  });

  describe("getCase", () => {
    test("should return a specific case by id", async () => {
      const caseId = "10002";
      db.findOne.mockResolvedValue(caseData2);

      const result = await caseRepository.getCase(caseId, db);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.findOne).toHaveBeenCalledWith({ id: caseId });
      expect(result).toEqual(caseData2);
    });

    test("should return null if case is not found", async () => {
      const caseId = "99999";

      db.findOne.mockResolvedValue(null);

      const result = await caseRepository.getCase(caseId, db);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.findOne).toHaveBeenCalledWith({ id: caseId });
      expect(result).toBeNull();
    });
  });
});
