import { describe, expect, it, vi } from "vitest";
import { caseData1, caseData2 } from "../../../test/fixtures/case.js";
import { db } from "../../common/mongo-client.js";
import { Case } from "../models/case.js";
import { findCasesUseCase } from "./list-cases.use-case.js";

describe("List Cases Use Case", () => {
  it("should find cases and return data as an array", async () => {
    const mockCaseList = [new Case(caseData1, caseData2)];

    const listQuery = {};

    const mockCursor = {
      estimatedDocumentCount: vi.fn().mockResolvedValue(10),
    };

    const mockToArray = vi.fn().mockReturnValue(mockCaseList);
    const mockMap = vi.fn().mockReturnValue(mockCursor);
    const mockLimit = vi.fn().mockReturnThis(mockCursor);
    const mockSkip = vi.fn().mockReturnValue(mockCursor);
    const mockFind = vi.fn().mockReturnValue(mockCursor);

    mockCursor.find = mockFind;
    mockCursor.skip = mockSkip;
    mockCursor.limit = mockLimit;
    mockCursor.map = mockMap;
    mockCursor.toArray = mockToArray;

    vi.spyOn(db, "collection").mockReturnValue(mockCursor);

    const cases = await findCasesUseCase(listQuery);
    expect(db.collection).toHaveBeenCalled();

    expect(cases).toEqual({
      status: "success",
      metadata: {
        ...listQuery,
        count: 10,
        pageCount: 1,
      },
      data: mockCaseList,
    });
  });
});
