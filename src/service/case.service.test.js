import { describe, it, expect, vi, afterEach } from "vitest";
import { caseService } from "./case.service.js";
import { caseRepository } from "../repository/case.repository.js";
import { caseData1, caseData2, caseData3 } from "../../test/fixtures/case.js";
import createCaseEvent1 from "../../test/fixtures/create-case-event-1.json";
import createCaseEvent3 from "../../test/fixtures/create-case-event-3.json";
import { workflowData1 } from "../../test/fixtures/workflow.js";
import { workflowRepository } from "../repository/workflow.repository.js";
import Boom from "@hapi/boom";

vi.mock("../repository/case.repository.js", () => ({
  caseRepository: {
    createCase: vi.fn(),
    findCases: vi.fn(),
    getCase: vi.fn()
  }
}));

vi.mock("../repository/workflow.repository.js", () => ({
  workflowRepository: {
    getWorkflow: vi.fn()
  }
}));

describe("caseService", () => {
  const mockDb = {}; // A mock database object

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("handleCreateCaseEvent", () => {
    it("should throw a bad request error if the workflow is not found", async () => {
      workflowRepository.getWorkflow.mockResolvedValue(null);
      await expect(() =>
        caseService.handleCreateCaseEvent(createCaseEvent1, mockDb)
      ).rejects.toThrow(
        Boom.badRequest(`Workflow ${createCaseEvent1.code} not found`)
      );
      expect(workflowRepository.getWorkflow).toHaveBeenCalledWith(
        createCaseEvent1.code,
        mockDb
      );
    });

    it("should validate and create a case successfully when workflow and payload are valid", async () => {
      const insertedId = "insertedId123";
      const mockCreatedCase = { _id: insertedId, ...caseData3 };
      const event = {
        ...createCaseEvent3,
        createdAt: new Date(createCaseEvent3.createdAt),
        submittedAt: new Date(createCaseEvent3.submittedAt)
      };

      workflowRepository.getWorkflow.mockResolvedValue(workflowData1);
      caseRepository.createCase.mockResolvedValue(mockCreatedCase);

      const result = await caseService.handleCreateCaseEvent(event, mockDb);

      expect(workflowRepository.getWorkflow).toHaveBeenCalledWith(
        createCaseEvent3.code,
        mockDb
      );
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        {
          ...caseData3,
          dateReceived: expect.any(String),
          payload: {
            ...caseData3.payload,
            createdAt: expect.any(Date),
            submittedAt: expect.any(Date)
          }
        },
        mockDb
      );
      expect(result).toEqual(mockCreatedCase);
    });

    it("should throw a validation error if the payload does not match the workflow schema", async () => {
      const mockDb = {};
      const event = {
        ...createCaseEvent3,
        createdAt: new Date(createCaseEvent3.createdAt),
        submittedAt: new Date(createCaseEvent3.submittedAt)
      };
      delete event.identifiers.sbi;
      delete event.answers.scheme;

      workflowRepository.getWorkflow.mockResolvedValue(workflowData1);

      await expect(
        caseService.handleCreateCaseEvent(event, mockDb)
      ).rejects.toThrow(
        `Case event with code "frps-private-beta" has invalid answers: data/identifiers must have required property 'sbi', data/answers must have required property 'scheme'`
      );

      expect(workflowRepository.getWorkflow).toHaveBeenCalledWith(
        createCaseEvent3.code,
        mockDb
      );
      expect(caseRepository.createCase).not.toHaveBeenCalled();
    });
  });

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
