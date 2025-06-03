import { describe, test, vi, expect } from "vitest";
import Boom from "@hapi/boom";
import { MongoServerError, ObjectId } from "mongodb";
import { db } from "../common/mongo-client.js";
import { caseRepository } from "./case.repository.js";
import { caseData1, caseData2 } from "../../test/fixtures/case.js";
import caseListResponse from "../../test/fixtures/case-list-response.json";

vi.mock("../common/mongo-client.js", () => ({
  db: {
    collection: vi.fn()
  }
}));

describe("createCase", () => {
  test("creates a case and returns it", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: true
    });

    db.collection.mockReturnValue({
      insertOne
    });

    const result = await caseRepository.createCase(caseData1);

    expect(db.collection).toHaveBeenCalledWith("cases");
    expect(insertOne).toHaveBeenCalledWith(caseData1);
    expect(result).toEqual(caseData1);
  });

  test("throws Boom.conflict when case with caseRef and workflowCode exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error)
    });

    await expect(caseRepository.createCase(caseData1)).rejects.toThrow(
      Boom.conflict(
        `Case with caseRef "${caseData1.caseRef}" and workflowCode "${caseData1.workflowCode}" already exists`
      )
    );
  });

  test("throws when an error occurs", async () => {
    const error = new Error("Unexpected error");

    const insertOne = vi.fn().mockRejectedValue(error);

    db.collection.mockReturnValue({
      insertOne
    });

    await expect(caseRepository.createCase(caseData1)).rejects.toThrow(error);
  });

  test("throws when write is unacknowledged", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: false
    });

    db.collection.mockReturnValue({
      insertOne
    });

    await expect(caseRepository.createCase(caseData1)).rejects.toThrow(
      Boom.internal(
        'Case with caseRef "APPLICATION-REF-1" and workflowCode "frps-private-beta" could not be created, the operation was not acknowledged'
      )
    );
  });
});

describe("findCases", () => {
  test("returns a list of cases", async () => {
    const listQuery = { page: 1, pageSize: 10 };
    const cases = [caseData1, caseData2];

    const limit = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(cases)
    });

    const skip = vi.fn().mockReturnValue({
      limit
    });

    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        skip
      }),
      estimatedDocumentCount: vi.fn().mockResolvedValue(cases.length)
    });

    const result = await caseRepository.findCases(listQuery);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(skip).toHaveBeenCalledWith(100 * (listQuery.page - 1));
    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toEqual(caseListResponse);
  });
});

describe("getCase", () => {
  test("returns a case by id", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";

    const foundCase = {
      _id: new ObjectId(caseId),
      ...caseData2
    };

    const findOne = vi.fn().mockReturnValue(foundCase);

    db.collection.mockReturnValue({
      findOne
    });

    const result = await caseRepository.getCase(caseId);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(findOne).toHaveBeenCalledWith({
      _id: new ObjectId(caseId)
    });

    expect(result).toEqual(foundCase);
  });

  test("returns null when no case is found", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";

    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null)
    });

    const result = await caseRepository.getCase(caseId);

    expect(result).toEqual(null);
  });
});
