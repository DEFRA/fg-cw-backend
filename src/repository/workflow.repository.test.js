import { describe, it, expect, vi } from "vitest";
import Boom from "@hapi/boom";
import { workflowRepository, collection } from "./workflow.repository.js";
import { workflowData1, workflowData2 } from "../../test/fixtures/workflow.js";
import workflowListResponse from "../../test/fixtures/workflow-list-response.json";
import { MongoServerError } from "mongodb";
import { db } from "../common/helpers/db.js";

vi.mock("../common/helpers/db.js", () => ({
  db: {
    collection: vi.fn().mockReturnThis()
  }
}));

describe("Workflow Repository", () => {
  describe("createWorkflow", () => {
    it("should create a new workflow and return it", async () => {
      const insertedId = "insertedId123";
      const insertOne = vi.fn().mockResolvedValueOnce({
        insertedId,
        acknowledged: true
      });

      db.collection.mockReturnValue({
        insertOne
      });

      await workflowRepository.createWorkflow(workflowData1);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(insertOne).toHaveBeenCalledWith(workflowData1);
    });

    it("should throw a conflict error if a workflow with the same code already exists", async () => {
      const error = new MongoServerError({ message: "Duplicate key error" });
      error.code = 11000; // Duplicate key error code

      db.collection.mockReturnValue({
        insertOne: vi.fn().mockRejectedValueOnce(error)
      });

      const promise = workflowRepository.createWorkflow(workflowData1);

      await expect(promise).rejects.toThrow(
        Boom.conflict(
          `Workflow with code: ${workflowData1.code} already exists`
        )
      );
    });

    it("should throw an internal error if the insert fails for any other reason", async () => {
      const error = new Error("Error creating workflow");

      db.collection.mockReturnValue({
        insertOne: vi.fn().mockResolvedValue(error)
      });

      const promise = workflowRepository.createWorkflow(workflowData1);
      await expect(promise).rejects.toThrow(Boom.internal(error));
    });

    it("should throw an internal error if the insert is not acknowledged", async () => {
      const error = new Error("Error creating workflow");

      db.collection.mockReturnValue({
        insertOne: vi
          .fn()
          .mockResolvedValue({ acknowledged: false, insertedId: null })
      });

      const workflowData = {
        code: "NOT_ACKNOWLEDGED",
        name: "Not Acknowledged Workflow"
      };
      const promise = workflowRepository.createWorkflow(workflowData);

      await expect(promise).rejects.toThrow(Boom.internal(error));
    });
  });

  describe("findWorkflows", () => {
    it("should query workflows and return paginated data", async () => {
      const listQuery = { page: 1, pageSize: 10 };
      const workflows = [workflowData1, workflowData2];

      const mockEstimatedCount = vi.fn().mockResolvedValue(2);

      const mockFind = vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(workflows)
      });

      db.collection.mockReturnValue({
        find: mockFind,
        estimatedDocumentCount: mockEstimatedCount
      });

      const result = await workflowRepository.findWorkflows(listQuery);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(mockFind).toHaveBeenCalled();
      expect(mockEstimatedCount).toHaveBeenCalled();
      expect(result).toEqual(workflowListResponse);
    });
  });

  describe("getWorkflow", () => {
    it("should fetch a workflow by workflow code and return it", async () => {
      const insertedId = "insertedId123";
      const expectedWorkflow = { _id: insertedId, ...workflowData1 };

      const findOne = vi.fn().mockResolvedValue(expectedWorkflow);

      db.collection.mockReturnValue({
        findOne
      });

      const code = "123";
      const result = await workflowRepository.getWorkflow(code);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(findOne).toHaveBeenCalledWith({ code });
      expect(result).toEqual(expectedWorkflow);
    });

    it("should return null if no workflow is found", async () => {
      const findOne = vi.fn().mockResolvedValue(null);

      db.collection.mockReturnValue({
        findOne
      });

      const code = "DOESNT_EXIST";
      const result = await workflowRepository.getWorkflow(code);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(findOne).toHaveBeenCalledWith({ code });
      expect(result).toBeNull();
    });
  });
});
