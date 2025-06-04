import { describe, it, expect, vi } from "vitest";
import Boom from "@hapi/boom";
import { caseService } from "./case.service.js";
import { caseRepository } from "../repositories/case.repository.js";
import { caseData1, caseData3 } from "../../test/fixtures/case.js";
import createCaseEvent1 from "../../test/fixtures/create-case-event-1.json";
import createCaseEvent3 from "../../test/fixtures/create-case-event-3.json";
import { workflowData1 } from "../../test/fixtures/workflow.js";
import { workflowRepository } from "../repositories/workflow.repository.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");

describe("caseService", () => {
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

      workflowRepository.getWorkflow.mockResolvedValue(workflowData1);
      caseRepository.createCase.mockResolvedValue(mockCreatedCase);

      const result = await caseService.handleCreateCaseEvent(
        createCaseEvent3.data
      );

      expect(workflowRepository.getWorkflow).toHaveBeenCalledWith(
        createCaseEvent3.data.code
      );
      expect(caseRepository.createCase).toHaveBeenCalledWith({
        ...caseData3,
        dateReceived: expect.any(String),
        payload: caseData3.payload,
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
