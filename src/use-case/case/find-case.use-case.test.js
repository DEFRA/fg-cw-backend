import { describe, it, expect, vi, beforeEach } from "vitest";
import { caseRepository } from "../../repository/case.repository";
import { findCaseUseCase } from "./find-case.use-case";
import { caseData1 } from "../../../test/fixtures/case";

describe("findCaseUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a case", async () => {
    const caseId = "123";
    const caseRecord = { ...caseData1, _id: caseId };
    vi.spyOn(caseRepository, "findOne").mockResolvedValue(caseRecord);
    const result = await findCaseUseCase(caseId);
    expect(result).toEqual(caseRecord);
  });

  it("should throw an error if the case is not found", async () => {
    const caseId = "123";
    vi.spyOn(caseRepository, "findOne").mockResolvedValue(null);
    await expect(findCaseUseCase(caseId)).rejects.toThrow(
      "Case with id 123 not found"
    );
  });
});
