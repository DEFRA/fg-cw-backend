import { describe, expect, it, vi } from "vitest";
import {
  workflowData1,
  workflowData2,
} from "../../../test/fixtures/workflow.js";
import { workflowRepository } from "../repositories/workflow.repository.js";
import { workflowService } from "./workflow.service.js";

vi.mock("../repositories/workflow.repository.js");

describe("Workflow Service", () => {
  describe("createWorkflow", () => {
    it("should call workflowRepository.createWorkflow with the correct parameters", async () => {
      const insertedId = "insertedId123";
      const mockResult = { _id: insertedId, ...workflowData1 };

      workflowRepository.createWorkflow.mockResolvedValue(mockResult);

      const result = await workflowService.createWorkflow(workflowData1);

      expect(workflowRepository.createWorkflow).toHaveBeenCalledWith(
        workflowData1,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("findWorkflows", () => {
    it("should call workflowRepository.findWorkflows with the correct parameters", async () => {
      const mockListQuery = { page: 1, pageSize: 10 };
      const mockResult = [workflowData1, workflowData2];

      workflowRepository.findWorkflows.mockResolvedValue(mockResult);

      const result = await workflowService.findWorkflows(mockListQuery);

      expect(workflowRepository.findWorkflows).toHaveBeenCalledWith(
        mockListQuery,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("getWorkflow", () => {
    it("should call workflowRepository.getWorkflow with the correct parameters", async () => {
      const mockWorkflowCode = "10001";
      const insertedId = "insertedId123";
      const mockResult = { _id: insertedId, ...workflowData1 };

      workflowRepository.getWorkflow.mockResolvedValue(mockResult);

      const result = await workflowService.getWorkflow(mockWorkflowCode);

      expect(workflowRepository.getWorkflow).toHaveBeenCalledWith(
        mockWorkflowCode,
      );
      expect(result).toEqual(mockResult);
    });
  });
});
