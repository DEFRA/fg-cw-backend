import Boom from "@hapi/boom";
import { MongoServerError } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import workflowListResponse from "../../../test/fixtures/workflow-list-response.json";
import {
  workflowData1,
  workflowData2,
} from "../../../test/fixtures/workflow.js";
import { db } from "../../common/mongo-client.js";
import { WorkflowDocument } from "../models/workflow-document.js";
import { Workflow } from "../models/workflow.js";
import { findAll, findByCode, save } from "./workflow.repository.js";

vi.mock("../../common/mongo-client.js", () => ({
  db: {
    collection: vi.fn(),
  },
}));

describe("save", () => {
  it("creates a workflow and returns it", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: true,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const result = await save(
      new Workflow({
        code: workflowData1.code,
        payloadDefinition: workflowData1.payloadDefinition,
        stages: workflowData1.stages,
      }),
    );

    expect(db.collection).toHaveBeenCalledWith("workflows");

    expect(insertOne).toHaveBeenCalledWith(
      new WorkflowDocument({
        code: workflowData1.code,
        payloadDefinition: workflowData1.payloadDefinition,
        stages: workflowData1.stages,
      }),
    );

    expect(result).toEqual(workflowData1);
  });

  it("throws Boom.conflict when a workflow with the same code exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    await expect(save(workflowData1)).rejects.toThrow(
      Boom.conflict(
        `Workflow with code "${workflowData1.code}" already exists`,
      ),
    );
  });

  it("throws when an error occurs", async () => {
    const error = new Error("Unexpected error");

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    await expect(save(workflowData1)).rejects.toThrow(error);
  });

  it("throws when write is unacknowledged", async () => {
    db.collection.mockReturnValue({
      insertOne: vi.fn().mockResolvedValue({
        acknowledged: false,
      }),
    });

    await expect(save(workflowData1)).rejects.toThrow(
      Boom.internal(
        `Workflow with code "${workflowData1.code}" could not be created, the operation was not acknowledged`,
      ),
    );
  });
});

describe("findAll", () => {
  it("returns a list of workflows", async () => {
    const listQuery = { page: 1, pageSize: 10 };
    const workflows = [workflowData1, workflowData2];

    const limit = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(workflows),
    });

    const skip = vi.fn().mockReturnValue({
      limit,
    });

    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        skip,
      }),
      estimatedDocumentCount: vi.fn().mockResolvedValue(workflows.length),
    });

    const result = await findAll(listQuery);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(skip).toHaveBeenCalledWith(0);
    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toEqual(workflowListResponse);
  });
});

describe("findByCode", () => {
  it("returns workflows by code", async () => {
    const insertedId = "insertedId123";
    const expectedWorkflow = { _id: insertedId, ...workflowData1 };

    const findOne = vi.fn().mockResolvedValue(expectedWorkflow);

    db.collection = vi.fn().mockReturnValue({
      findOne,
    });

    const code = "123";
    const result = await findByCode(code);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(findOne).toHaveBeenCalledWith({ code });
    expect(result).toEqual(expectedWorkflow);
  });

  it("returns null when no workflow is found", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const code = "DOESNT_EXIST";
    const result = await findByCode(code);

    expect(result).toEqual(null);
  });
});
