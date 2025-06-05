import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";
import { caseData1, caseData2 } from "../../test/fixtures/case.js";
import { findCasesUseCase } from "../cases/use-cases/list-cases.use-case.js";
import { caseService } from "../services/case.service.js";
import {
  caseCreateController,
  caseDetailController,
  caseListController,
} from "./case.controller.js";

vi.mock("../cases/use-cases/list-cases.use-case.js");
vi.mock("../services/case.service.js");

describe("case.controller.js", () => {
  const mockRequest = {
    payload: caseData1,
    params: { caseId: "10001" },
  };

  const mockResponseToolkit = {
    response: vi.fn((payload) => payload),
    code: vi.fn(),
  };

  describe("caseCreateController", () => {
    it("should create a case and return the response", async () => {
      const insertedId = "insertedId123";
      const mockCreatedCase = { _id: insertedId, ...caseData1 };
      const mockResponse = { code: vi.fn() };
      caseService.createCase.mockResolvedValue(mockCreatedCase);
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
        { _id: "insertedId002", ...caseData2 },
      ];
      findCasesUseCase.mockResolvedValue(mockCases);

      const result = await caseListController(mockRequest, mockResponseToolkit);

      expect(findCasesUseCase).toHaveBeenCalledWith({
        page: 1,
        pageSize: 100,
      });
      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockCases);
      expect(result).toEqual(mockCases);
    });
  });

  describe("caseDetailController", () => {
    it("should return case details for a valid case ID", async () => {
      const insertedId = "insertedId123";
      const mockCase = { _id: insertedId, ...caseData1 };
      caseService.getCase.mockResolvedValue(mockCase);

      const result = await caseDetailController(
        mockRequest,
        mockResponseToolkit,
      );

      expect(caseService.getCase).toHaveBeenCalledWith(
        mockRequest.params.caseId,
      );
      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockCase);
      expect(result).toEqual(mockCase);
    });

    it("should return a Boom.notFound error if case is not found", async () => {
      caseService.getCase.mockResolvedValue(null);

      const result = await caseDetailController(
        mockRequest,
        mockResponseToolkit,
      );

      expect(caseService.getCase).toHaveBeenCalledWith(
        mockRequest.params.caseId,
      );
      expect(result).toEqual(
        Boom.notFound(
          "Case with id: " + mockRequest.params.caseId + " not found",
        ),
      );
    });
  });
});
