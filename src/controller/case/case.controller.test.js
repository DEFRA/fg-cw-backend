import { describe, it, expect, vi } from "vitest";
import { caseListController, caseDetailController } from "./case.controller.js";
import { caseData1, caseData2 } from "../../../test/fixtures/case.js";
import { listCasesUseCase } from "../../use-case/case/list-cases.use-case.js";
import { findCaseUseCase } from "../../use-case/case/find-case.use-case.js";
import Boom from "@hapi/boom";

vi.mock("../../service/handlers.service.js", () => ({
  caseService: {
    createCase: vi.fn(),
    findCases: vi.fn(),
    getCase: vi.fn()
  }
}));

vi.mock("../../common/helpers/db.js", () => ({
  db: {
    collection: vi.fn().mockReturnThis()
  }
}));

vi.mock("../../use-case/case/find-case.use-case.js", () => ({
  findCaseUseCase: vi.fn()
}));

vi.mock("../../use-case/case/list-cases.use-case.js", () => ({
  listCasesUseCase: vi.fn()
}));

describe("handlers.controller.js", () => {
  const mockRequest = {
    payload: caseData1,
    params: { caseId: "10001" }
  };

  const mockResponseToolkit = {
    response: vi.fn((payload) => payload),
    code: vi.fn()
  };

  describe("caseListController", () => {
    it("should return a list of cases", async () => {
      const mockCases = [
        { _id: "insertedId001", ...caseData1 },
        { _id: "insertedId002", ...caseData2 }
      ];

      listCasesUseCase.mockResolvedValue(mockCases);

      const result = await caseListController(mockRequest, mockResponseToolkit);

      expect(listCasesUseCase).toHaveBeenCalledWith({
        page: 1,
        pageSize: 100
      });
      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockCases);
      expect(result).toEqual(mockCases);
    });
  });

  describe("caseDetailController", () => {
    it("should return handlers details for a valid handlers ID", async () => {
      const insertedId = "insertedId123";
      const mockCase = { _id: insertedId, ...caseData1 };

      findCaseUseCase.mockResolvedValue(mockCase);

      const result = await caseDetailController(
        mockRequest,
        mockResponseToolkit
      );

      expect(findCaseUseCase).toHaveBeenCalledWith(mockRequest.params.caseId);
      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockCase);
      expect(result).toEqual(mockCase);
    });

    it("should return a Boom.notFound error if handlers is not found", async () => {
      findCaseUseCase.mockRejectedValue(
        Boom.notFound(
          "Case with id " + mockRequest.params.caseId + " not found"
        )
      );

      await expect(
        caseDetailController(mockRequest, mockResponseToolkit)
      ).rejects.toThrow(
        Boom.notFound(
          "Case with id " + mockRequest.params.caseId + " not found"
        )
      );

      expect(findCaseUseCase).toHaveBeenCalledWith(mockRequest.params.caseId);
    });
  });
});
