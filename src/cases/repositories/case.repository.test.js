import Boom from "@hapi/boom";
import { MongoServerError, ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import caseListResponse from "../../../test/fixtures/case-list-response.json";
import { caseData1, caseData2 } from "../../../test/fixtures/case.js";
import { db } from "../../common/mongo-client.js";
import { CaseDocument } from "../models/case-document.js";
import { Case } from "../models/case.js";
import { findAll, findById, save, updateStage } from "./case.repository.js";

vi.mock("../../common/mongo-client.js", () => ({
  db: {
    collection: vi.fn(),
  },
}));

describe("save", () => {
  it("creates a case and returns it", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: true,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    await save(
      new Case({
        workflowCode: "frps-private-beta",
        caseRef: "APPLICATION-REF-1",
        status: "NEW",
        currentStage: "application-receipt",
        dateReceived: "2025-03-27T11:34:52.000Z",
        priority: "MEDIUM",
        payload: {},
        stages: [],
      }),
    );

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(insertOne).toHaveBeenCalledWith(
      new CaseDocument({
        workflowCode: "frps-private-beta",
        caseRef: "APPLICATION-REF-1",
        status: "NEW",
        currentStage: "application-receipt",
        dateReceived: "2025-03-27T11:34:52.000Z",
        priority: "MEDIUM",
        payload: {},
        stages: [],
      }),
    );
  });

  it("throws Boom.conflict when case with caseRef and workflowCode exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    await expect(save(caseData1)).rejects.toThrow(
      Boom.conflict(
        `Case with caseRef "${caseData1.caseRef}" and workflowCode "${caseData1.workflowCode}" already exists`,
      ),
    );
  });

  it("throws when an error occurs", async () => {
    const error = new Error("Unexpected error");

    const insertOne = vi.fn().mockRejectedValue(error);

    db.collection.mockReturnValue({
      insertOne,
    });

    await expect(save(caseData1)).rejects.toThrow(error);
  });

  it("throws when write is unacknowledged", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: false,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    await expect(save(caseData1)).rejects.toThrow(
      Boom.internal(
        'Case with caseRef "APPLICATION-REF-1" and workflowCode "frps-private-beta" could not be created, the operation was not acknowledged',
      ),
    );
  });
});

describe("findAll", () => {
  it("returns a list of cases", async () => {
    const listQuery = { page: 1, pageSize: 10 };
    const cases = [caseData1, caseData2];

    const limit = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(cases),
    });

    const skip = vi.fn().mockReturnValue({
      limit,
    });

    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        skip,
      }),
      estimatedDocumentCount: vi.fn().mockResolvedValue(cases.length),
    });

    const result = await findAll(listQuery);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(skip).toHaveBeenCalledWith(100 * (listQuery.page - 1));
    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toEqual(caseListResponse);
  });
});

describe("findById", () => {
  it("returns a case by id", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";

    const foundCase = {
      _id: new ObjectId(caseId),
      ...caseData2,
    };

    const findOne = vi.fn().mockReturnValue(foundCase);

    db.collection.mockReturnValue({
      findOne,
    });

    const result = await findById(caseId);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(findOne).toHaveBeenCalledWith({
      _id: new ObjectId(caseId),
    });

    expect(result).toEqual(foundCase);
  });

  it("returns null when no case is found", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";

    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const result = await findById(caseId);

    expect(result).toEqual(null);
  });
});

describe("updateStage", () => {
  it("updates the stage of a case", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";

    const updateOne = vi.fn().mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    db.collection.mockReturnValue({
      updateOne,
    });

    await updateStage(caseId, "application-receipt");

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(updateOne).toHaveBeenCalledWith(
      { _id: new ObjectId(caseId) },
      { $set: { currentStage: "application-receipt" } },
    );
  });
});
