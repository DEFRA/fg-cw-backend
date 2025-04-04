// describe("Case controllers", () => {
//   let server;
//
//   beforeAll(async () => {
//     server = hapi.server();
//     await server.register([router]);
//     await server.initialize();
//   });
//
//   describe("caseCreateController", () => {
//     it("should create a case and return the correct response", async () => {
//       caseService.createCase.mockResolvedValueOnce(caseData1);
//       const { statusCode, result } = await server.inject({
//         method: "POST",
//         url: "/cases",
//         payload: caseData1
//       });
//       expect(statusCode).toBe(200);
//       expect(result).equals(caseData1)
//       expect(caseService.createCase).toBeCalled();
//     });
//   });
// });
import { describe, it, expect, vi } from "vitest";
import {
  caseCreateController,
  caseListController,
  caseDetailController
} from "./case.controller.js";
import { caseData1, caseData2 } from "../../test/fixtures/case.js";
import { caseService } from "../service/case.service.js";
import Boom from "@hapi/boom";

vi.mock("../service/case.service.js", () => ({
  caseService: {
    createCase: vi.fn(),
    findCases: vi.fn(),
    getCase: vi.fn()
  }
}));

describe("case.controller.js", () => {
  const mockRequest = {
    payload: caseData1,
    params: { caseId: "10001" },
    db: {} // Mock database
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
      caseService.createCase.mockResolvedValue(mockCreatedCase);
      const h = { response: vi.fn(() => mockResponse) }; // Mock the response toolkit

      await caseCreateController(mockRequest, h);

      expect(caseService.createCase).toHaveBeenCalledWith(
        mockRequest.payload,
        mockRequest.db
      );
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
      caseService.findCases.mockResolvedValue(mockCases);

      const result = await caseListController(mockRequest, mockResponseToolkit);

      expect(caseService.findCases).toHaveBeenCalledWith(mockRequest.db);
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
        mockResponseToolkit
      );

      expect(caseService.getCase).toHaveBeenCalledWith(
        mockRequest.params.caseId,
        mockRequest.db
      );
      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockCase);
      expect(result).toEqual(mockCase);
    });

    it("should return a Boom.notFound error if case is not found", async () => {
      caseService.getCase.mockResolvedValue(null);

      const result = await caseDetailController(
        mockRequest,
        mockResponseToolkit
      );

      expect(caseService.getCase).toHaveBeenCalledWith(
        mockRequest.params.caseId,
        mockRequest.db
      );
      expect(result).toEqual(
        Boom.notFound(
          "Case with id: " + mockRequest.params.caseId + " not found"
        )
      );
    });
  });
});
