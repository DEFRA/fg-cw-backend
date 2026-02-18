import Boom from "@hapi/boom";
import { MongoServerError, ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { db } from "../../common/mongo-client.js";
import { paginate } from "../../common/paginate.js";
import { Case } from "../models/case.js";
import { TimelineEvent } from "../models/timeline-event.js";
import {
  findAll,
  findByCaseRefAndWorkflowCode,
  findById,
  save,
  update,
  updateStage,
} from "./case.repository.js";
import { CaseDocument } from "./case/case-document.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/paginate.js");

describe("save", () => {
  it("creates a case and returns it", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: true,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const caseMock = Case.createMock();

    await save(caseMock);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(insertOne.mock.calls[0][0]).toBeInstanceOf(CaseDocument);
  });

  it("throws Boom.conflict when case with caseRef and workflowCode exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    const caseMock = Case.createMock();

    await expect(save(caseMock)).rejects.toThrow(
      Boom.conflict(
        `Case with caseRef "${caseMock.caseRef}" and workflowCode "${caseMock.workflowCode}" already exists`,
      ),
    );
  });

  it("throws when an error occurs", async () => {
    const error = new Error("Unexpected error");

    const insertOne = vi.fn().mockRejectedValue(error);

    db.collection.mockReturnValue({
      insertOne,
    });

    const caseMock = Case.createMock();

    await expect(save(caseMock)).rejects.toThrow(error);
  });

  it("throws when write is unacknowledged", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: false,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const caseMock = Case.createMock();

    await expect(save(caseMock)).rejects.toThrow(
      Boom.internal(
        'Case with caseRef "case-ref" and workflowCode "workflow-code" could not be created, the operation was not acknowledged',
      ),
    );
  });
});

describe("update", () => {
  it("updates a case and returns it", async () => {
    const replaceOne = vi.fn().mockResolvedValue({
      acknowledged: true,
      matchedCount: 1,
    });

    db.collection.mockReturnValue({
      replaceOne,
    });

    const caseMock = Case.createMock();

    const result = await update(caseMock);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(replaceOne).toHaveBeenCalledWith(
      { _id: caseMock.objectId },
      new CaseDocument(caseMock),
    );

    expect(result).toBe(caseMock);
  });

  it("throws bad request when case is not found", async () => {
    const replaceOne = vi.fn().mockResolvedValue({
      acknowledged: true,
      matchedCount: 0,
    });

    db.collection.mockReturnValue({
      replaceOne,
    });

    const caseMock = Case.createMock();

    await expect(update(caseMock)).rejects.toThrow(
      `Case with id "${caseMock._id}" not found`,
    );
  });

  it("throws bad request when write is unacknowledged", async () => {
    const replaceOne = vi.fn().mockResolvedValue({
      acknowledged: false,
      matchedCount: 1,
    });

    db.collection.mockReturnValue({
      replaceOne,
    });

    const caseMock = Case.createMock();

    await expect(update(caseMock)).rejects.toThrow(
      `Case with caseRef "${caseMock.caseRef}" could not be updated, the operation was not acknowledged`,
    );
  });
});

describe("findAll", () => {
  it("calls paginate with correct options", async () => {
    const mockCollection = {};
    db.collection.mockReturnValue(mockCollection);

    const paginateResult = { data: [], pagination: { totalCount: 0 } };
    paginate.mockResolvedValue(paginateResult);

    const result = await findAll({
      workflowCodes: ["WORKFLOW_1"],
      cursor: undefined,
      direction: "forward",
      sort: { createdAt: "desc" },
      pageSize: 20,
    });

    expect(db.collection).toHaveBeenCalledWith("cases");
    expect(paginate).toHaveBeenCalledWith(
      mockCollection,
      expect.objectContaining({
        filter: { workflowCode: { $in: ["WORKFLOW_1"] } },
        cursor: undefined,
        direction: "forward",
        pageSize: 20,
      }),
    );
    expect(result).toEqual(paginateResult);
  });

  it("passes codecs that correctly encode and decode cursor values", async () => {
    db.collection.mockReturnValue({});
    paginate.mockResolvedValue({ data: [], pagination: {} });

    await findAll({
      workflowCodes: ["WF"],
      cursor: undefined,
      direction: "forward",
      sort: { createdAt: "desc" },
      pageSize: 10,
    });

    const { codecs } = paginate.mock.calls[0][1];

    // caseRef codec is identity
    expect(codecs.caseRef.encode("REF-001")).toBe("REF-001");
    expect(codecs.caseRef.decode("REF-001")).toBe("REF-001");

    // createdAt codec converts Date <-> ISO string
    const date = new Date("2025-06-01T12:00:00.000Z");
    expect(codecs.createdAt.encode(date)).toBe("2025-06-01T12:00:00.000Z");
    expect(codecs.createdAt.decode("2025-06-01T12:00:00.000Z")).toEqual(date);

    // _id codec converts ObjectId <-> hex string
    const oid = ObjectId.createFromHexString("6800c9feb76f8f854ebf901a");
    expect(codecs._id.encode(oid)).toBe("6800c9feb76f8f854ebf901a");
    expect(codecs._id.decode("6800c9feb76f8f854ebf901a")).toEqual(oid);
  });

  it("passes mapDocument that maps case documents correctly", async () => {
    db.collection.mockReturnValue({});
    paginate.mockResolvedValue({ data: [], pagination: {} });

    await findAll({
      workflowCodes: ["WF"],
      cursor: undefined,
      direction: "forward",
      sort: { createdAt: "desc" },
      pageSize: 10,
    });

    const { mapDocument } = paginate.mock.calls[0][1];

    const oid = new ObjectId();
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    const doc = {
      _id: oid,
      caseRef: "REF-001",
      workflowCode: "WF",
      currentPhase: "PHASE_1",
      currentStage: "STAGE_1",
      currentStatus: "STATUS_1",
      assignedUserId: "user-123",
      payload: { foo: "bar" },
      createdAt,
    };

    const mapped = mapDocument(doc);

    expect(mapped).toEqual({
      _id: oid,
      caseRef: "REF-001",
      workflowCode: "WF",
      position: expect.objectContaining({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "STATUS_1",
      }),
      assignedUserId: "user-123",
      payload: { foo: "bar" },
      createdAt,
    });
  });

  it("converts sort directions to MongoDB sort flags", async () => {
    db.collection.mockReturnValue({});
    paginate.mockResolvedValue({ data: [], pagination: {} });

    await findAll({
      workflowCodes: ["WF"],
      cursor: undefined,
      direction: "forward",
      sort: { createdAt: "desc", caseRef: "asc" },
      pageSize: 10,
    });

    const { sort } = paginate.mock.calls[0][1];
    expect(sort).toEqual({ createdAt: -1, caseRef: 1 });
  });

  it("filters out undefined sort values", async () => {
    db.collection.mockReturnValue({});
    paginate.mockResolvedValue({ data: [], pagination: {} });

    await findAll({
      workflowCodes: ["WF"],
      cursor: undefined,
      direction: "forward",
      sort: { createdAt: "desc", caseRef: undefined },
      pageSize: 10,
    });

    const { sort } = paginate.mock.calls[0][1];
    expect(sort).toEqual({ createdAt: -1 });
  });
});

describe("findByCaseRefAndWorkflowCode", () => {
  it("finds case", async () => {
    const doc = CaseDocument.createMock();
    const ref = doc.caseRef;
    const findOne = vi.fn().mockReturnValue(doc);

    db.collection.mockReturnValue({
      findOne,
    });
    const result = await findByCaseRefAndWorkflowCode(ref, "workflow-code");
    expect(result.caseRef).toBe(ref);
  });
});

describe("findById", () => {
  it("returns a case by id", async () => {
    const doc = CaseDocument.createMock();
    const caseId = doc._id.toString();

    const findOne = vi.fn().mockReturnValue(doc);

    db.collection.mockReturnValue({
      findOne,
    });

    const result = await findById(caseId);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(findOne).toHaveBeenCalledWith({
      _id: doc._id,
    });

    expect(result).toEqual(
      Case.createMock({
        _id: caseId,
        assignedUser: { id: "64c88faac1f56f71e1b89a33" },
        requiredRoles: undefined,
      }),
    );
  });

  it("returns null when no case is found", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";

    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const result = await findById(caseId);

    expect(result).toEqual(null);
  });

  it("maps task commentRefs from database document", async () => {
    const doc = CaseDocument.createMock();
    const caseId = doc._id.toString();

    // Add commentRefs to the task in the document
    doc.phases[0].stages[0].taskGroups[0].tasks[0].commentRefs = [
      { status: "ACCEPTED", ref: "abc123def456" },
    ];

    const findOne = vi.fn().mockReturnValue(doc);

    db.collection.mockReturnValue({
      findOne,
    });

    const result = await findById(caseId);

    const task = result.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.commentRefs).toEqual([
      { status: "ACCEPTED", ref: "abc123def456" },
    ]);
  });
});

describe("updateStage", () => {
  it("updates the stage of a case", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";
    const timelineEvent = TimelineEvent.createMock();

    const updateOne = vi.fn().mockResolvedValue({
      acknowledged: true,
      matchedCount: 1,
    });

    db.collection.mockReturnValue({
      updateOne,
    });

    await updateStage(caseId, "APPLICATION_RECEIPT", timelineEvent);

    expect(db.collection).toHaveBeenCalledWith("cases");

    expect(updateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(caseId) },
      {
        $set: { currentStage: "APPLICATION_RECEIPT" },
        $push: {
          timeline: {
            $each: [timelineEvent],
            $position: 0,
          },
        },
      },
    );
  });

  it("throws Boom.notFound when case is not found", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";

    db.collection.mockReturnValue({
      updateOne: vi.fn().mockResolvedValue({
        acknowledged: true,
        matchedCount: 0,
      }),
    });

    await expect(updateStage(caseId, "APPLICATION_RECEIPT")).rejects.toThrow(
      Boom.notFound(`Case with id "${caseId}" not found`),
    );
  });
});
