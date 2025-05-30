import { describe, expect, it, vi } from "vitest";

import {
  workflowCreateController,
  workflowDetailController,
  workflowListController
} from "./workflow.controller.js";
import { workflowData1 } from "../../../test/fixtures/workflow.js";
import { createWorkflowUseCase } from "../../use-case/workflow/create-workflow.use-case.js";
import { listWorkflowsUseCase } from "../../use-case/workflow/list-workflows.use-case.js";
import { findWorkflowUseCase } from "../../use-case/workflow/find-workflow.use-case.js";

vi.mock("../../use-case/workflow/create-workflow.use-case.js", () => ({
  createWorkflowUseCase: vi.fn()
}));

vi.mock("../../use-case/workflow/find-workflow.use-case.js", () => ({
  findWorkflowUseCase: vi.fn()
}));

vi.mock("../../use-case/workflow/list-workflows.use-case.js", () => ({
  listWorkflowsUseCase: vi.fn()
}));

vi.mock("../service/workflow.use-case.js", () => ({
  workflowService: {
    createWorkflow: vi.fn(),
    findWorkflows: vi.fn(),
    getWorkflow: vi.fn()
  }
}));

describe("workflow.controller.js", () => {
  const mockRequest = {
    payload: workflowData1,
    params: { code: "9001" },
    db: {}
  };

  const mockResponseToolkit = {
    response: vi.fn((payload) => payload),
    code: vi.fn()
  };

  describe("workflowCreateController", () => {
    it("should create a workflow and return 201 status", async () => {
      const mockResponse = { code: vi.fn() };

      createWorkflowUseCase.mockResolvedValue();
      const h = { response: vi.fn(() => mockResponse) }; // Mock the response toolkit

      await workflowCreateController(mockRequest, h);

      expect(createWorkflowUseCase).toHaveBeenCalledWith(mockRequest.payload);
      expect(h.response).toHaveBeenCalled();
      expect(mockResponse.code).toHaveBeenCalledWith(201);
    });
  });

  describe("workflowListController", () => {
    it("should fetch a list of workflows and return them", async () => {
      const mockWorkflows = [
        { _id: "insertedId001", ...workflowData1 },
        { _id: "insertedId002", ...workflowData1 }
      ];
      listWorkflowsUseCase.mockResolvedValue(mockWorkflows);

      const result = await workflowListController(
        mockRequest,
        mockResponseToolkit
      );

      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockWorkflows);
      expect(result).toEqual(mockWorkflows);
    });
  });

  describe("workflowDetailController", () => {
    it("should return workflow details if workflow exists", async () => {
      const insertedId = "insertedId123";
      const mockWorkflow = { _id: insertedId, ...workflowData1 };
      findWorkflowUseCase.mockResolvedValue(mockWorkflow);

      const result = await workflowDetailController(
        mockRequest,
        mockResponseToolkit
      );

      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockWorkflow);
      expect(result).toEqual(mockWorkflow);
      expect(result._id).toBe(insertedId);
    });

    it("should return a Boom error if workflow is not found", async () => {
      findWorkflowUseCase.mockRejectedValue(
        "Workflow with code 9001 not found"
      );

      await expect(
        workflowDetailController(mockRequest, mockResponseToolkit)
      ).rejects.toThrow("Workflow with code 9001 not found");
    });
  });
});
