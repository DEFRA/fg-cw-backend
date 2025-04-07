import { describe, it, expect, vi } from "vitest";
import { caseService } from "./case.service.js";
import { caseRepository } from "../repository/case.repository.js";
import { caseData1, caseData2 } from "../../test/fixtures/case.js";

vi.mock("../repository/case.repository.js", () => ({
  caseRepository: {
    createCase: vi.fn(),
    findCases: vi.fn(),
    getCase: vi.fn()
  }
}));

describe("caseService", () => {
  const mockDb = {}; // A mock database object

  describe("createCase", () => {
    it("should call createCase on caseRepository with correct arguments", async () => {
      const insertedId = "insertedId123";
      const mockResult = { _id: insertedId, ...caseData1 };

      caseRepository.createCase.mockResolvedValue(mockResult);

      const result = await caseService.createCase(caseData1, mockDb);

      expect(caseRepository.createCase).toHaveBeenCalledWith(caseData1, mockDb);
      expect(result).toEqual(mockResult);
    });
  });

  describe("findCases", () => {
    it("should call findCases on caseRepository and return the cases", async () => {
      const listQuery = {};
      const mockCases = [caseData1, caseData2];

      caseRepository.findCases.mockResolvedValue(mockCases);

      const result = await caseService.findCases(listQuery, mockDb);

      expect(caseRepository.findCases).toHaveBeenCalledWith(listQuery, mockDb);
      expect(result).toEqual(mockCases);
    });
  });

  describe("getCase", () => {
    it("should call getCase on caseRepository with correct arguments", async () => {
      const mockCaseId = "10001";
      const insertedId = "insertedId123";
      const mockResult = { _id: insertedId, ...caseData1 };

      caseRepository.getCase.mockResolvedValue(mockResult);

      const result = await caseService.getCase(mockCaseId, mockDb);

      expect(caseRepository.getCase).toHaveBeenCalledWith(mockCaseId, mockDb);
      expect(result).toEqual(mockResult);
    });
  });
});
