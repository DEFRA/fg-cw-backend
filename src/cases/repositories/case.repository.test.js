import Boom from "@hapi/boom";
import { MongoServerError, ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
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

    const caseMock = Case.createMock();

    await save(caseMock);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(insertOne).toHaveBeenCalledWith(
      CaseDocument.createMock({
        _id: caseMock._id,
      }),
    );
  });

  it("throws Boom.conflict when case with caseRef and workflowCode exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    const caseMock = Case.createMock();

    await expect(save(caseMock)).rejects.toThrow(
      Boom.conflict(
        `Case with caseRef "${caseMock.caseRef}" and workflowCode "${caseMock.workflowCode}" already exists`,
      ),
    );
  });

  it("throws when an error occurs", async () => {
    const error = new Error("Unexpected error");

    const insertOne = vi.fn().mockRejectedValue(error);

    db.collection.mockReturnValue({
      insertOne,
    });

    const caseMock = Case.createMock();

    await expect(save(caseMock)).rejects.toThrow(error);
  });

  it("throws when write is unacknowledged", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: false,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const caseMock = Case.createMock();

    await expect(save(caseMock)).rejects.toThrow(
      Boom.internal(
        'Case with caseRef "case-ref" and workflowCode "workflow-code" could not be created, the operation was not acknowledged',
      ),
    );
  });
});

describe("findAll", () => {
  it("returns a list of cases", async () => {
    const cases = [CaseDocument.createMock(), CaseDocument.createMock()];

    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(cases),
      }),
    });

    const result = await findAll();

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(result).toEqual([
      Case.createMock({
        _id: cases[0]._id.toString(),
      }),
      Case.createMock({
        _id: cases[1]._id.toString(),
      }),
    ]);
  });
});

describe("findById", () => {
  it("returns a case by id", async () => {
    const doc = CaseDocument.createMock();
    const caseId = doc._id.toString();

    const findOne = vi.fn().mockReturnValue(doc);

    db.collection.mockReturnValue({
      findOne,
    });

    const result = await findById(caseId);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(findOne).toHaveBeenCalledWith({
      _id: doc._id,
    });

    expect(result).toEqual(
      Case.createMock({
        _id: caseId,
      }),
    );
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
      { _id: ObjectId.createFromHexString(caseId) },
      { $set: { currentStage: "application-receipt" } },
    );
  });

  it("throws Boom.notFound when case is not found", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";

    db.collection.mockReturnValue({
      updateOne: vi.fn().mockResolvedValue({
        acknowledged: true,
        modifiedCount: 0,
      }),
    });

    await expect(updateStage(caseId, "application-receipt")).rejects.toThrow(
      Boom.notFound(`Case with id "${caseId}" not found`),
    );
  });
});
