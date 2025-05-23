import { describe, it, expect, vi } from "vitest";
import {
  caseCreateController,
  caseListController,
  caseDetailController
} from "./case.controller.js";
import { caseData1, caseData2 } from "../../../test/fixtures/case.js";
import { caseService } from "../../service/case.service.js";
import Boom from "@hapi/boom";

vi.mock("../../service/case.service.js", () => ({
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

describe("case.controller.js", () => {
  const mockRequest = {
    payload: caseData1,
    params: { caseId: "10001" }
  };

  const mockResponseToolkit = {
    response: vi.fn((payload) => payload),
    code: vi.fn()
  };

  describe("caseCreateController", () => {
    it("should create a case and return the response", async () => {
      const insertedId = "insertedId123";
      const mockCreatedCase = { _id: insertedId, ...caseData1 };
      const mockResponse = { code: vi.fn() };

      vi.spyOn(caseService, "createCase").mockResolvedValue(mockCreatedCase);

      const h = { response: vi.fn(() => mockResponse) }; // Mock the response toolkit

      await caseCreateController(mockRequest, h);

      expect(caseService.createCase).toHaveBeenCalledWith(mockRequest.payload);
      expect(h.response).toHaveBeenCalledWith(mockCreatedCase);
      expect(mockResponse.code).toHaveBeenCalledWith(201);
    });
  });

  describe("caseListController", () => {
    it("should return a list of cases", async () => {
      const mockCases = [
        { _id: "insertedId001", ...caseData1 },
        { _id: "insertedId002", ...caseData2 }
      ];

      vi.spyOn(caseService, "findCases").mockResolvedValue(mockCases);

      const result = await caseListController(mockRequest, mockResponseToolkit);

      expect(caseService.findCases).toHaveBeenCalledWith({
        page: 1,
        pageSize: 100
      });
      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockCases);
      expect(result).toEqual(mockCases);
    });
  });

  describe("caseDetailController", () => {
    it("should return case details for a valid case ID", async () => {
      const insertedId = "insertedId123";
      const mockCase = { _id: insertedId, ...caseData1 };

      vi.spyOn(caseService, "getCase").mockResolvedValue(mockCase);

      const result = await caseDetailController(
        mockRequest,
        mockResponseToolkit
      );

      expect(caseService.getCase).toHaveBeenCalledWith(
        mockRequest.params.caseId
      );
      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockCase);
      expect(result).toEqual(mockCase);
    });

    it("should return a Boom.notFound error if case is not found", async () => {
      vi.spyOn(caseService, "getCase").mockResolvedValue(null);

      const result = await caseDetailController(
        mockRequest,
        mockResponseToolkit
      );

      expect(caseService.getCase).toHaveBeenCalledWith(
        mockRequest.params.caseId
      );
      expect(result).toEqual(
        Boom.notFound(
          "Case with id: " + mockRequest.params.caseId + " not found"
        )
      );
    });
  });
});
