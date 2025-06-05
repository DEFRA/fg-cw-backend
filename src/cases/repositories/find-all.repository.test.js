import { describe, expect, it, vi } from "vitest";
import caseListResponse from "../../../test/fixtures/case-list-response.json";
import { caseData1, caseData2 } from "../../../test/fixtures/case.js";
import { db } from "../../common/mongo-client.js";
import { findAll } from "./find-all.repository.js";

vi.mock("../../common/mongo-client.js", () => ({
  db: {
    collection: vi.fn(),
  },
}));

describe("findAll", () => {
  it("returns a list of cases", async () => {
    const listQuery = { page: 1, pageSize: 10 };
    const cases = [caseData1, caseData2];

    const mockCursor = {
      estimatedDocumentCount: vi.fn().mockResolvedValue(2),
    };

    const mockToArray = vi.fn().mockReturnValue(cases);
    const mockMap = vi.fn().mockReturnValue(mockCursor);
    const mockLimit = vi.fn().mockReturnThis(mockCursor);
    const mockSkip = vi.fn().mockReturnValue(mockCursor);
    const mockFind = vi.fn().mockReturnValue(mockCursor);

    mockCursor.find = mockFind;
    mockCursor.skip = mockSkip;
    mockCursor.limit = mockLimit;
    mockCursor.map = mockMap;
    mockCursor.toArray = mockToArray;

    db.collection.mockReturnValue(mockCursor);

    const result = await findAll(listQuery);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(mockSkip).toHaveBeenCalledWith(100 * (listQuery.page - 1));
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(result).toEqual(caseListResponse);
  });
});
