import Boom from "@hapi/boom";
import { MongoServerError } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { caseData1 } from "../../../test/fixtures/case.js";
import { db } from "../../common/mongo-client.js";
import { createCase } from "./create-case.repository.js";

vi.mock("../../common/mongo-client.js", () => ({
  db: {
    collection: vi.fn(),
  },
}));

describe("createCase", () => {
  it("creates a case and returns it", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: true,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const result = await createCase(caseData1);

    expect(db.collection).toHaveBeenCalledWith("cases");
    expect(insertOne).toHaveBeenCalledWith(caseData1);
    expect(result).toEqual({ acknowledged: true });
  });

  it("throws Boom.conflict when case with caseRef and workflowCode exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    await expect(createCase(caseData1)).rejects.toThrow(
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

    await expect(createCase(caseData1)).rejects.toThrow(error);
  });

  it("throws when write is unacknowledged", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: false,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    await expect(createCase(caseData1)).rejects.toThrow(
      Boom.internal(
        'Case with caseRef "APPLICATION-REF-1" and workflowCode "frps-private-beta" could not be created, the operation was not acknowledged',
      ),
    );
  });
});
