import { describe, expect, it, vi } from "vitest";
import Boom from "@hapi/boom";
import {
  workflowCreateController,
  workflowDetailController,
  workflowListController
} from "./workflow.controller.js";
import { workflowService } from "../service/workflow.service.js";
import { workflowData1 } from "../../test/fixtures/workflow.js";

vi.mock("../service/workflow.service.js", () => ({
  workflowService: {
    createWorkflow: vi.fn(),
    findWorkflows: vi.fn(),
    getWorkflow: vi.fn()
  }
}));

describe("workflow.controller.js", () => {
  const mockRequest = {
    payload: workflowData1,
    params: { workflowCode: "9001" },
    db: {}
  };

  const mockResponseToolkit = {
    response: vi.fn((payload) => payload),
    code: vi.fn()
  };

  describe("workflowCreateController", () => {
    it("should create a workflow and return 201 status", async () => {
      const insertedId = "insertedId123";
      const mockCreatedWorkflow = { _id: insertedId, ...workflowData1 };
      const mockResponse = { code: vi.fn() };
      workflowService.createWorkflow.mockResolvedValue(mockCreatedWorkflow);
      const h = { response: vi.fn(() => mockResponse) }; // Mock the response toolkit

      await workflowCreateController(mockRequest, h);

      expect(workflowService.createWorkflow).toHaveBeenCalledWith(
        mockRequest.payload,
        mockRequest.db
      );
      expect(h.response).toHaveBeenCalledWith(mockCreatedWorkflow);
      expect(mockResponse.code).toHaveBeenCalledWith(201);
    });
  });

  describe("workflowListController", () => {
    it("should fetch a list of workflows and return them", async () => {
      const mockWorkflows = [
        { _id: "insertedId001", ...workflowData1 },
        { _id: "insertedId002", ...workflowData1 }
      ];
      workflowService.findWorkflows.mockResolvedValue(mockWorkflows);

      const result = await workflowListController(
        mockRequest,
        mockResponseToolkit
      );

      expect(workflowService.findWorkflows).toHaveBeenCalledWith(
        { page: 1, pageSize: 100 },
        mockRequest.db
      );
      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockWorkflows);
      expect(result).toEqual(mockWorkflows);
    });
  });

  describe("workflowDetailController", () => {
    it("should return workflow details if workflow exists", async () => {
      const insertedId = "insertedId123";
      const mockWorkflow = { _id: insertedId, ...workflowData1 };
      workflowService.getWorkflow.mockResolvedValue(mockWorkflow);

      const result = await workflowDetailController(
        mockRequest,
        mockResponseToolkit
      );

      expect(workflowService.getWorkflow).toHaveBeenCalledWith(
        mockRequest.params.workflowCode,
        mockRequest.db
      );
      expect(mockResponseToolkit.response).toHaveBeenCalledWith(mockWorkflow);
      expect(result).toEqual(mockWorkflow);
    });

    it("should return a Boom error if workflow is not found", async () => {
      workflowService.getWorkflow.mockResolvedValue(null);

      const result = await workflowDetailController(
        mockRequest,
        mockResponseToolkit
      );
      expect(workflowService.getWorkflow).toHaveBeenCalledWith(
        mockRequest.params.workflowCode,
        mockRequest.db
      );
      expect(result).toEqual(
        Boom.notFound(
          "Workflow with id: " + mockRequest.params.workflowCode + " not found"
        )
      );
    });
  });
});
