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
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("handleCreateCaseEvent", () => {
    it("should throw a bad request error if the workflow is not found", async () => {
      workflowRepository.getWorkflow.mockResolvedValue(null);
      await expect(() =>
        caseService.handleCreateCaseEvent(createCaseEvent1)
      ).rejects.toThrow(
        Boom.badRequest(`Workflow ${createCaseEvent1.code} not found`)
      );
      expect(workflowRepository.getWorkflow).toHaveBeenCalledWith(
        createCaseEvent1.code
      );
    });

    it("should create a case successfully", async () => {
      const insertedId = "insertedId123";
      const mockCreatedCase = { _id: insertedId, ...caseData3 };
      const createdAt = new Date(createCaseEvent3.createdAt);
      const submittedAt = new Date(createCaseEvent3.submittedAt);

      const event = {
        ...createCaseEvent3,
        createdAt,
        submittedAt
      };

      workflowRepository.getWorkflow.mockResolvedValue(workflowData1);
      caseRepository.createCase.mockResolvedValue(mockCreatedCase);

      const result = await caseService.handleCreateCaseEvent(event);

      expect(workflowRepository.getWorkflow).toHaveBeenCalledWith(
        createCaseEvent3.code
      );
      expect(caseRepository.createCase).toHaveBeenCalledWith({
        ...caseData3,
        dateReceived: expect.any(String),
        payload: {
          ...caseData3.payload,
          createdAt,
          submittedAt
        },
        currentStage: workflowData1.stages[0].id,
        stages: [
          {
            id: "application-receipt",
            taskGroups: [
              {
                id: "application-receipt-tasks",
                tasks: [
                  {
                    id: "simple-review",
                    isComplete: false
                  }
                ]
              }
            ]
          },
          {
            id: "contract",
            taskGroups: []
          }
        ]
      });
      expect(result).toEqual(mockCreatedCase);
    });
  });

  describe("createCase", () => {
    it("should call createCase on caseRepository with correct arguments", async () => {
      const insertedId = "insertedId123";
      const mockResult = { _id: insertedId, ...caseData1 };

      caseRepository.createCase.mockResolvedValue(mockResult);

      const result = await caseService.createCase(caseData1);

      expect(caseRepository.createCase).toHaveBeenCalledWith(caseData1);
      expect(result).toEqual(mockResult);
    });
  });

  describe("findCases", () => {
    it("should call findCases on caseRepository and return the cases", async () => {
      const listQuery = {};
      const mockCases = [caseData1, caseData2];

      caseRepository.findCases.mockResolvedValue(mockCases);

      const result = await caseService.findCases(listQuery);

      expect(caseRepository.findCases).toHaveBeenCalledWith(listQuery);
      expect(result).toEqual(mockCases);
    });
  });

  describe("getCase", () => {
    it("should call getCase on caseRepository with correct arguments", async () => {
      const mockCaseId = "10001";
      const insertedId = "insertedId123";
      const mockResult = { _id: insertedId, ...caseData1 };

      caseRepository.getCase.mockResolvedValue(mockResult);

      const result = await caseService.getCase(mockCaseId);

      expect(caseRepository.getCase).toHaveBeenCalledWith(mockCaseId);
      expect(result).toEqual(mockResult);
    });
  });
});
