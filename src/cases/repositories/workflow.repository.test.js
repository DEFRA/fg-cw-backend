import Boom from "@hapi/boom";
import { MongoServerError } from "mongodb";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { Workflow } from "../models/workflow.js";
import { createRoleFilter } from "../use-cases/find-cases.use-case.js";
import { findAll, findByCode, save } from "./workflow.repository.js";
import { WorkflowDocument } from "./workflow/workflow-document.js";

vi.mock("../../common/mongo-client.js");
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));

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
    expect(insertOne.mock.calls[0][0]).toBeInstanceOf(WorkflowDocument);
    expect(insertOne.mock.calls[0][0]).toEqual(new WorkflowDocument(workflow));
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
      WorkflowDocument.createMock(),
      WorkflowDocument.createMock(),
    ];

    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(workflows),
      }),
    });

    const result = await findAll();

    expect(db.collection).toHaveBeenCalledWith("workflows");

    expect(result[0]).toBeInstanceOf(Workflow);
    expect(result[1]).toBeInstanceOf(Workflow);
    expect(result[0]._id.toString()).toEqual(workflows[0]._id.toString());
    expect(result[1]._id.toString()).toEqual(workflows[1]._id.toString());
    expect(result[0].templates).toEqual(workflows[0].templates);
    expect(result[1].templates).toEqual(workflows[1].templates);
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
    expect(result[0].code).toBe("WORKFLOW_A");
    expect(result[0]._id.toString()).toBe(workflows[0]._id.toString());
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
    expect(result[0].code).toBe("WORKFLOW_A");
    expect(result[1].code).toBe("WORKFLOW_C");
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
    expect(result[0]._id.toString()).toEqual(workflows[0]._id.toString());
    expect(result[1]._id.toString()).toEqual(workflows[1]._id.toString());
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

    const query = createRoleFilter(["ROLE_1", "ROLE_3"]);
    const result = await findAll(query);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(find).toHaveBeenCalledWith({
      ...query,
    });

    expect(result[0]._id.toString()).toEqual(workflows[0]._id.toString());
  });
});

describe("findByCode", () => {
  it("returns workflows by code", async () => {
    const workflowDocument = WorkflowDocument.createMock();

    const findOne = vi.fn().mockResolvedValue(workflowDocument);

    db.collection = vi.fn().mockReturnValue({
      findOne,
    });

    const code = "123";
    const result = await findByCode(code);

    expect(db.collection).toHaveBeenCalledWith("workflows");
    expect(findOne).toHaveBeenCalledWith({ code });
    expect(result._id.toString()).toEqual(workflowDocument._id.toString());
    expect(result.templates).toEqual(workflowDocument.templates);
  });

  it("maps status option comment when present", async () => {
    const workflowDocument = WorkflowDocument.createMock();
    workflowDocument.phases[0].stages[0].taskGroups[0].tasks[0].statusOptions[0].comment =
      {
        label: "Explain this outcome",
        helpText: "You must include an explanation for auditing purposes.",
        mandatory: true,
      };

    db.collection = vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue(workflowDocument),
    });

    const result = await findByCode("123");
    const statusOption =
      result.phases[0].stages[0].taskGroups[0].tasks[0].statusOptions[0];

    expect(statusOption.comment).toEqual({
      label: "Explain this outcome",
      helpText: "You must include an explanation for auditing purposes.",
      mandatory: true,
    });
  });

  it("returns null when no workflow is found", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const result = await findByCode("DOESNT_EXIST");

    expect(result).toEqual(null);
  });
});

describe("workflow definition overrides", () => {
  const MANIFEST_PATH = "/cfg/overrides.json";

  const mockConfig = (cdpEnvironment, workflowOverrides) => {
    vi.spyOn(config, "get").mockImplementation((key) => {
      if (key === "cdpEnvironment") {
        return cdpEnvironment;
      }
      if (key === "workflowOverrides") {
        return workflowOverrides;
      }
      return undefined;
    });
  };

  const mockFiles = (files) => {
    readFileSync.mockImplementation((path) => {
      if (files[path] === undefined) {
        throw new Error(`unexpected readFileSync: ${path}`);
      }
      return files[path];
    });
  };

  it("loads the workflow from the override file instead of the database", async () => {
    mockConfig("local", MANIFEST_PATH);
    const overrideDoc = WorkflowDocument.createMock({ code: "woodland" });
    delete overrideDoc._id;
    mockFiles({
      [MANIFEST_PATH]: JSON.stringify({ woodland: "woodland.json" }),
      "/cfg/woodland.json": JSON.stringify(overrideDoc),
    });
    const findOne = vi.fn();
    db.collection.mockReturnValue({ findOne });

    const result = await findByCode("woodland");

    expect(result).toBeInstanceOf(Workflow);
    expect(result.code).toBe("woodland");
    expect(findOne).not.toHaveBeenCalled();
  });

  it("falls back to the database when not running locally", async () => {
    mockConfig("prod", MANIFEST_PATH);
    const workflowDocument = WorkflowDocument.createMock({ code: "woodland" });
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(workflowDocument),
    });

    const result = await findByCode("woodland");

    expect(result.code).toBe("woodland");
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("falls back to the database when no override is configured", async () => {
    mockConfig("local", null);
    const workflowDocument = WorkflowDocument.createMock({ code: "woodland" });
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(workflowDocument),
    });

    const result = await findByCode("woodland");

    expect(result.code).toBe("woodland");
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("falls back to the database when the code is not in the manifest", async () => {
    mockConfig("local", MANIFEST_PATH);
    mockFiles({ [MANIFEST_PATH]: JSON.stringify({ other: "other.json" }) });
    const workflowDocument = WorkflowDocument.createMock({ code: "woodland" });
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(workflowDocument),
    });

    const result = await findByCode("woodland");

    expect(result.code).toBe("woodland");
  });

  it("replaces matching database workflows with overrides in findAll", async () => {
    mockConfig("local", MANIFEST_PATH);
    const overrideDoc = WorkflowDocument.createMock({ code: "woodland" });
    delete overrideDoc._id;
    overrideDoc.templates = { caseDetails: "from-override" };
    mockFiles({
      [MANIFEST_PATH]: JSON.stringify({ woodland: "woodland.json" }),
      "/cfg/woodland.json": JSON.stringify(overrideDoc),
    });
    const dbDocs = [
      WorkflowDocument.createMock({ code: "woodland" }),
      WorkflowDocument.createMock({ code: "other" }),
    ];
    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(dbDocs),
      }),
    });

    const result = await findAll();

    expect(result[0].code).toBe("woodland");
    expect(result[0].templates).toEqual({ caseDetails: "from-override" });
    expect(result[1].code).toBe("other");
  });
});
