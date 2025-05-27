import { describe, it, expect, vi } from "vitest";
import { workflowUseCase } from "./workflow.use-case.js";
import { workflowRepository } from "../../repository/workflow.repository.js";
import {
  workflowData1,
  workflowData2
} from "../../../test/fixtures/workflow.js";

vi.mock("../repository/workflow.repository.js", () => ({
  workflowRepository: {
    createWorkflow: vi.fn(),
    findWorkflows: vi.fn(),
    getWorkflow: vi.fn()
  }
}));

describe("Workflow Service", () => {
  const mockDb = {}; // A mock database object

  describe("createWorkflow", () => {
    it("should call workflowRepository.createWorkflow with the correct parameters", async () => {
      const insertedId = "insertedId123";
      const mockResult = { _id: insertedId, ...workflowData1 };

      workflowRepository.createWorkflow.mockResolvedValue(mockResult);

      const result = await workflowUseCase.createWorkflow(
        workflowData1,
        mockDb
      );

      expect(workflowRepository.createWorkflow).toHaveBeenCalledWith(
        workflowData1,
        mockDb
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("findWorkflows", () => {
    it("should call workflowRepository.findWorkflows with the correct parameters", async () => {
      const mockListQuery = { page: 1, pageSize: 10 };
      const mockResult = [workflowData1, workflowData2];

      workflowRepository.findWorkflows.mockResolvedValue(mockResult);

      const result = await workflowUseCase.findWorkflows(mockListQuery, mockDb);

      expect(workflowRepository.findWorkflows).toHaveBeenCalledWith(
        mockListQuery,
        mockDb
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("getWorkflow", () => {
    it("should call workflowRepository.getWorkflow with the correct parameters", async () => {
      const mockWorkflowCode = "10001";
      const insertedId = "insertedId123";
      const mockResult = { _id: insertedId, ...workflowData1 };

      // Mock implementation of workflowRepository.getCase
      workflowRepository.getWorkflow.mockResolvedValue(mockResult);

      const result = await workflowUseCase.getWorkflow(
        mockWorkflowCode,
        mockDb
      );

      expect(workflowRepository.getWorkflow).toHaveBeenCalledWith(
        mockWorkflowCode,
        mockDb
      );
      expect(result).toEqual(mockResult);
    });
  });
});
