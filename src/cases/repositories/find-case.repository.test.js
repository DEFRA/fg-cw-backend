import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { caseData2 } from "../../../test/fixtures/case.js";
import { db } from "../../common/mongo-client.js";
import { findCase } from "./find-case.repository.js";

vi.mock("../../common/mongo-client.js", () => ({
  db: {
    collection: vi.fn(),
  },
}));

describe("getCase", () => {
  it("returns a case by id", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";
    const _id = new ObjectId(caseId);

    const foundCase = {
      _id,
      ...caseData2,
    };

    const mockFind = vi.fn().mockReturnValue(foundCase);
    const mockCursor = {
      findOne: mockFind,
    };

    db.collection.mockReturnValue(mockCursor);

    const result = await findCase(caseId);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(mockFind).toHaveBeenCalledWith({
      _id,
    });

    expect(result).toEqual(foundCase);
  });

  it("returns null when no case is found", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";

    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const result = await findCase(caseId);

    expect(result).toEqual(null);
  });
});
