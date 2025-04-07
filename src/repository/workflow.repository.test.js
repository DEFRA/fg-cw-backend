import { describe, it, expect, vi, beforeAll } from "vitest";
import Boom from "@hapi/boom";
import { workflowRepository, collection } from "./workflow.repository.js";
import { workflowData1, workflowData2 } from "../../test/fixtures/workflow.js";
import workflowListResponse from "../../test/fixtures/workflow-list-response.json";
import { MongoServerError } from "mongodb";

describe("Workflow Repository", () => {
  let db;

  beforeAll(() => {
    db = {
      collection: vi.fn().mockReturnThis(),
      insertOne: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      estimatedDocumentCount: vi.fn(),
      skip: vi.fn(),
      limit: vi.fn()
    };
    db.find.mockReturnThis();
    db.skip.mockReturnThis();
    db.limit.mockReturnThis();
  });

  describe("createWorkflow", () => {
    it("should create a new workflow and return it", async () => {
      const insertedId = "insertedId123";
      const expectedWorkflow = { _id: insertedId, ...workflowData1 };

      db.insertOne.mockResolvedValue({ acknowledged: true, insertedId });
      db.findOne.mockResolvedValue(expectedWorkflow);

      const result = await workflowRepository.createWorkflow(workflowData1, db);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.insertOne).toHaveBeenCalledWith(workflowData1);
      expect(db.findOne).toHaveBeenCalledWith({ _id: insertedId });
      expect(result).toEqual(expectedWorkflow);
    });

    it("should throw a conflict error if a workflow with the same code already exists", async () => {
      const error = new MongoServerError({ message: "Duplicate key error" });
      error.code = 11000; // Duplicate key error code

      db.insertOne.mockRejectedValue(error);

      await expect(
        workflowRepository.createWorkflow(workflowData1, db)
      ).rejects.toThrow(
        Boom.conflict(
          `Workflow with code: ${workflowData1.code} already exists`
        )
      );

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.insertOne).toHaveBeenCalledWith(workflowData1);
    });

    it("should throw an internal error if the insert fails for any other reason", async () => {
      const error = new Error("Unexpected error");
      db.insertOne.mockRejectedValue(error);

      await expect(
        workflowRepository.createWorkflow(workflowData1, db)
      ).rejects.toThrow(Boom.internal(error));

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.insertOne).toHaveBeenCalledWith(workflowData1);
    });

    it("should throw an internal error if the insert is not acknowledged", async () => {
      db.collection.mockReturnThis();
      db.insertOne.mockResolvedValue({ acknowledged: false, insertedId: null });

      const workflowData = {
        code: "NOT_ACKNOWLEDGED",
        name: "Not Acknowledged Workflow"
      };

      await expect(
        workflowRepository.createWorkflow(workflowData, db)
      ).rejects.toThrow(Boom.internal("Error creating workflow"));

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.insertOne).toHaveBeenCalledWith(workflowData);
    });
  });

  describe("findWorkflows", () => {
    it("should query workflows and return paginated data", async () => {
      const listQuery = { page: 1, pageSize: 10 };
      const workflows = [workflowData1, workflowData2];

      db.toArray.mockResolvedValue(workflows);
      db.estimatedDocumentCount.mockResolvedValue(2);

      const result = await workflowRepository.findWorkflows(listQuery, db);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.estimatedDocumentCount).toHaveBeenCalled();
      expect(db.find).toHaveBeenCalled();
      expect(db.skip).toHaveBeenCalledWith(0);
      expect(db.limit).toHaveBeenCalledWith(10);
      expect(db.toArray).toHaveBeenCalled();
      expect(result).toEqual(workflowListResponse);
    });
  });

  describe("getWorkflow", () => {
    it("should fetch a workflow by workflow code and return it", async () => {
      const insertedId = "insertedId123";
      const expectedWorkflow = { _id: insertedId, ...workflowData1 };

      db.collection.mockReturnThis();
      db.findOne.mockResolvedValue(expectedWorkflow);

      const workflowCode = "123";
      const result = await workflowRepository.getWorkflow(workflowCode, db);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.findOne).toHaveBeenCalledWith({ workflowCode: workflowCode });
      expect(result).toEqual(expectedWorkflow);
    });

    it("should return null if no workflow is found", async () => {
      db.collection.mockReturnThis();
      db.findOne.mockResolvedValue(null);

      const workflowCode = "DOESNT_EXIST";
      const result = await workflowRepository.getWorkflow(workflowCode, db);

      expect(db.collection).toHaveBeenCalledWith(collection);
      expect(db.findOne).toHaveBeenCalledWith({ workflowCode: workflowCode });
      expect(result).toBeNull();
    });
  });
});
