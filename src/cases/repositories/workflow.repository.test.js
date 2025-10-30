import Boom from "@hapi/boom";
import { MongoServerError } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { db } from "../../common/mongo-client.js";
import { WorkflowDocument } from "../models/workflow-document.js";
import { Workflow } from "../models/workflow.js";
import { createUserRolesFilter } from "../use-cases/find-cases.use-case.js";
import { findAll, findByCode, save } from "./workflow.repository.js";

vi.mock("../../common/mongo-client.js");

describe("save", () => {
  it("creates a workflow and returns it", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: true,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const workflow = Workflow.createMock();

    await save(workflow);

    expect(db.collection).toHaveBeenCalledWith("workflows");

    expect(insertOne).toHaveBeenCalledWith(
      WorkflowDocument.createMock({
        _id: workflow._id,
      }),
    );
  });

  it("throws Boom.conflict when a workflow with the same code exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    const workflow = Workflow.createMock();

    await expect(save(workflow)).rejects.toThrow(
      Boom.conflict(`Workflow with code "${workflow.code}" already exists`),
    );
  });

  it("throws when an error occurs", async () => {
    const error = new Error("Unexpected error");

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    const workflow = Workflow.createMock();

    await expect(save(workflow)).rejects.toThrow(error);
  });

  it("throws when write is unacknowledged", async () => {
    db.collection.mockReturnValue({
      insertOne: vi.fn().mockResolvedValue({
        acknowledged: false,
      }),
    });

    const workflow = Workflow.createMock();

    await expect(save(workflow)).rejects.toThrow(
      Boom.internal(
        `Workflow with code "${workflow.code}" could not be created, the operation was not acknowledged`,
      ),
    );
  });
});

describe("findAll", () => {
  it("returns a list of workflows", async () => {
    const workflows = [
      WorkflowDocument.createMock({
        externalActions: [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
            target: {
              node: "rulesHistory",
              nodeType: "array",
              position: "append",
            },
          },
        ],
      }),
      WorkflowDocument.createMock(),
    ];

    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(workflows),
      }),
    });

    const result = await findAll();

    expect(db.collection).toHaveBeenCalledWith("workflows");

    expect(result).toEqual([
      Workflow.createMock({
        _id: workflows[0]._id.toString(),
        externalActions: workflows[0].externalActions,
      }),
      Workflow.createMock({
        _id: workflows[1]._id.toString(),
      }),
    ]);
  });

  it("returns workflows filtered by single code", async () => {
    const workflows = [
      WorkflowDocument.createMock({ code: "WORKFLOW_A" }),
      WorkflowDocument.createMock({ code: "WORKFLOW_B" }),
    ];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([workflows[0]]),
    });

    db.collection.mockReturnValue({ find });

    const query = { codes: ["WORKFLOW_A"] };
    const result = await findAll(query);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(find).toHaveBeenCalledWith({
      code: { $in: ["WORKFLOW_A"] },
    });
    expect(result).toEqual([
      Workflow.createMock({
        _id: workflows[0]._id.toString(),
        code: "WORKFLOW_A",
      }),
    ]);
  });

  it("returns workflows filtered by multiple codes", async () => {
    const workflows = [
      WorkflowDocument.createMock({ code: "WORKFLOW_A" }),
      WorkflowDocument.createMock({ code: "WORKFLOW_B" }),
      WorkflowDocument.createMock({ code: "WORKFLOW_C" }),
    ];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([workflows[0], workflows[2]]),
    });

    db.collection.mockReturnValue({ find });

    const query = { codes: ["WORKFLOW_A", "WORKFLOW_C"] };
    const result = await findAll(query);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(find).toHaveBeenCalledWith({
      code: { $in: ["WORKFLOW_A", "WORKFLOW_C"] },
    });
    expect(result).toEqual([
      Workflow.createMock({
        _id: workflows[0]._id.toString(),
        code: "WORKFLOW_A",
      }),
      Workflow.createMock({
        _id: workflows[2]._id.toString(),
        code: "WORKFLOW_C",
      }),
    ]);
  });

  it("returns all workflows when codes query is empty", async () => {
    const workflows = [
      WorkflowDocument.createMock(),
      WorkflowDocument.createMock(),
    ];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(workflows),
    });

    db.collection.mockReturnValue({ find });

    const query = { codes: [] };
    const result = await findAll(query);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(find).toHaveBeenCalledWith({});
    expect(result).toEqual([
      Workflow.createMock({
        _id: workflows[0]._id.toString(),
      }),
      Workflow.createMock({
        _id: workflows[1]._id.toString(),
      }),
    ]);
  });

  it("returns no results when no workflows match the codes", async () => {
    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    });

    db.collection.mockReturnValue({ find });

    const query = { codes: ["NON_EXISTENT_CODE"] };
    const result = await findAll(query);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(find).toHaveBeenCalledWith({
      code: { $in: ["NON_EXISTENT_CODE"] },
    });
    expect(result).toEqual([]);
  });

  it("uses filters passed to mongodb", async () => {
    const workflows = [
      WorkflowDocument.createMock({ code: "WORKFLOW_A" }),
      WorkflowDocument.createMock({ code: "WORKFLOW_B" }),
    ];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([workflows[0]]),
    });

    db.collection.mockReturnValue({ find });

    const query = createUserRolesFilter(["ROLE_1", "ROLE_3"]);
    const result = await findAll(query);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(find).toHaveBeenCalledWith({
      ...query,
    });

    expect(result).toEqual([
      Workflow.createMock({
        _id: workflows[0]._id.toString(),
        code: "WORKFLOW_A",
      }),
    ]);
  });
});

describe("findByCode", () => {
  it("returns workflows by code", async () => {
    const workflowDocument = WorkflowDocument.createMock({
      externalActions: [
        {
          code: "RERUN_RULES",
          name: "Rerun Rules",
          endpoint: "landGrantsRulesRerun",
          target: {
            node: "rulesHistory",
            nodeType: "array",
            position: "append",
          },
        },
      ],
    });

    const findOne = vi.fn().mockResolvedValue(workflowDocument);

    db.collection = vi.fn().mockReturnValue({
      findOne,
    });

    const code = "123";
    const result = await findByCode(code);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(findOne).toHaveBeenCalledWith({ code });
    expect(result).toEqual(
      Workflow.createMock({
        _id: workflowDocument._id.toString(),
        externalActions: workflowDocument.externalActions,
      }),
    );
  });

  it("returns null when no workflow is found", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const result = await findByCode("DOESNT_EXIST");

    expect(result).toEqual(null);
  });
});
