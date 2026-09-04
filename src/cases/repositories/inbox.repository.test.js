import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { paginate } from "../../common/paginate.js";
import { Inbox, InboxStatus } from "../models/inbox.js";
import {
  breakdown,
  claimEvents,
  countFacets,
  findByMessageId,
  findDetailById,
  findNextMessage,
  findPage,
  findStatusById,
  insertMany,
  insertOne,
  processExpiredEvents,
  redriveById,
  update,
  updateDeadEvents,
  updateFailedEvents,
  updateResubmittedEvents,
} from "./inbox.repository.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/paginate.js");

const createMockInbox = (id, time) => {
  return Inbox.createMock({
    _id: id,
    event: {
      time,
    },
  });
};

describe("inbox.repository", () => {
  it("should find next message excluding locked segregationRefs", async () => {
    const lockIds = ["ref-1", "ref-2"];
    const mockDoc = { _id: "1" };
    const findOne = vi.fn().mockResolvedValue(mockDoc);

    db.collection.mockReturnValue({ findOne });

    const result = await findNextMessage(lockIds);

    expect(findOne).toHaveBeenCalledWith(
      {
        status: { $eq: InboxStatus.PUBLISHED },
        claimedBy: { $eq: null },
        completionAttempts: {
          $lt: parseInt(config.get("inbox.inboxMaxRetries")),
        },
        segregationRef: { $nin: lockIds },
      },
      { sort: { eventTime: 1 } },
    );
    expect(result).toBe(mockDoc);
  });

  it("should claim events", async () => {
    const claimedBy = randomUUID();
    const mockDocuments = [
      createMockInbox("1", new Date(Date.now() - 1000).toISOString()),
      createMockInbox("3", new Date(Date.now() - 2000).toISOString()),
    ];

    const findOneAndUpdate = vi.fn();
    findOneAndUpdate
      .mockResolvedValueOnce(mockDocuments[0])
      .mockResolvedValueOnce(mockDocuments[1]);

    db.collection.mockReturnValue({
      findOneAndUpdate,
    });

    const results = await claimEvents(claimedBy);
    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(Inbox);
    expect(results[1]).toBeInstanceOf(Inbox);
    expect(results[0]._id).toBe("1");
    expect(results[1]._id).toBe("3");
  });

  it("should insert many", async () => {
    const insertMany = vi.fn().mockResolvedValueOnce({ modifiedCount: 1 });
    db.collection.mockReturnValue({ insertMany });

    const events = [Inbox.createMock(), Inbox.createMock()];

    const mockSession = vi.fn();
    await insertMany(events, mockSession);
    expect(insertMany).toHaveBeenCalledWith(events, mockSession);
  });

  it("should process expired events", async () => {
    const updateMany = vi.fn().mockResolvedValue({});
    db.collection.mockReturnValue({
      updateMany,
    });

    await processExpiredEvents();

    expect(updateMany).toHaveBeenCalledWith(
      {
        claimExpiresAt: {
          $lt: expect.any(Date),
        },
        status: { $nin: [InboxStatus.DEAD_LETTER, InboxStatus.COMPLETED] },
      },
      {
        $set: {
          status: InboxStatus.FAILED,
          lastError: {
            name: "ClaimExpired",
            message: "claim expired before completion",
            at: expect.any(String),
          },
          claimedAt: null,
          claimedBy: null,
          claimExpiresAt: null,
        },
        $inc: { completionAttempts: 1 },
        $push: {
          attemptHistory: {
            $each: [
              {
                at: expect.any(String),
                name: "ClaimExpired",
                message: "claim expired before completion",
              },
            ],
            $slice: -10,
          },
        },
      },
    );
  });

  it("should update dead events", async () => {
    const updateMany = vi.fn().mockResolvedValue({});
    db.collection.mockReturnValue({ updateMany });

    await updateDeadEvents();

    expect(updateMany).toHaveBeenCalledWith(
      {
        completionAttempts: {
          $gte: parseInt(config.get("inbox.inboxMaxRetries")),
        },
        status: { $ne: InboxStatus.DEAD_LETTER },
      },
      {
        $set: {
          status: InboxStatus.DEAD_LETTER,
          claimedAt: null,
          claimExpiresAt: null,
          claimedBy: null,
        },
      },
    );
  });

  it("should update resubmitted events", async () => {
    const updateMany = vi.fn().mockResolvedValue({});
    db.collection.mockReturnValue({ updateMany });

    await updateResubmittedEvents();

    expect(updateMany).toHaveBeenCalledWith(
      {
        status: InboxStatus.RESUBMITTED,
      },
      {
        $set: {
          status: InboxStatus.PUBLISHED,
          claimedAt: null,
          claimExpiresAt: null,
          claimedBy: null,
        },
      },
    );
  });

  it("should update failed events", async () => {
    const updateMany = vi.fn().mockResolvedValue({});
    db.collection.mockReturnValue({ updateMany });

    await updateFailedEvents();

    expect(updateMany).toHaveBeenCalledWith(
      {
        status: InboxStatus.FAILED,
      },
      {
        $set: {
          status: InboxStatus.RESUBMITTED,
          claimedAt: null,
          claimExpiresAt: null,
          claimedBy: null,
        },
      },
    );
  });

  it("should insertMany", async () => {
    const insertManySpy = vi.fn();
    db.collection.mockReturnValue({ insertMany: insertManySpy });
    const session = {};

    const events = [
      Inbox.createMock({
        event: {
          some_data_bar: "foo",
        },
      }),
    ];

    await insertMany(events, session);

    expect(insertManySpy).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          event: {
            some_data_bar: "foo",
          },
        }),
      ],
      { session },
    );
  });

  it("should findByMessageId", async () => {
    const id = randomUUID();
    const mockDoc = { _id: id };
    const findOneMock = vi.fn().mockResolvedValue(mockDoc);
    db.collection.mockReturnValue({ findOne: findOneMock });
    const doc = await findByMessageId(id);
    expect(findOneMock).toHaveBeenCalledWith({ messageId: id });
    expect(mockDoc).toEqual(doc);
  });

  it("should insertOne", async () => {
    const id = randomUUID();
    const insertOneMock = vi.fn();
    db.collection.mockReturnValue({ insertOne: insertOneMock });
    const session = {};
    const doc = Inbox.createMock({
      _id: id,
    });
    await insertOne(doc, session);
    expect(insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: id,
      }),
      { session },
    );
  });

  it("should update a document", async () => {
    const id = randomUUID();
    const inbox = Inbox.createMock({ _id: id });
    vi.spyOn(inbox, "toDocument").mockReturnValue({
      _id: id,
      someOtherValue: "foo",
    });
    const updateOneMock = vi.fn();
    db.collection.mockReturnValue({ updateOne: updateOneMock });

    await update(inbox);

    expect(inbox.toDocument).toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: id },
      {
        $set: expect.objectContaining({ someOtherValue: "foo" }),
      },
    );
  });
});

describe("inbox.repository findPage", () => {
  const callFindPage = async (args = {}) => {
    paginate.mockResolvedValue({ data: [], pagination: {} });

    await findPage({ direction: "forward", pageSize: 20, ...args });

    return paginate.mock.calls.at(-1)[1];
  };

  const mapOne = async (doc, args = {}) => {
    const opts = await callFindPage(args);
    return opts.mapDocument(doc);
  };

  const objectId = new ObjectId("665f1c2e9a1b2c3d4e5f6a7b");

  const aDoc = (overrides = {}) => ({
    _id: objectId,
    messageId: "msg-1",
    type: "cloud.defra.prd.fg-gas-backend.case.create.new",
    source: "GAS",
    segregationRef: "GLD-9B2",
    status: InboxStatus.PUBLISHED,
    completionAttempts: 1,
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    eventTime: "2026-06-16T10:00:00.000Z",
    lastResubmissionDate: null,
    completionDate: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(paginate).mockReset();
  });

  it("sorts newest first with an _id tie-break", async () => {
    const opts = await callFindPage();

    expect(opts.sort).toEqual({ eventTime: -1, _id: -1 });
  });

  it("skips the total count", async () => {
    const opts = await callFindPage();

    expect(opts.withTotal).toBe(false);
  });

  it("filters by status when given", async () => {
    const opts = await callFindPage({ status: InboxStatus.DEAD_LETTER });

    expect(opts.filter).toEqual({ status: InboxStatus.DEAD_LETTER });
  });

  it("uses an empty filter when status is absent", async () => {
    const opts = await callFindPage();

    expect(opts.filter).toEqual({});
  });

  it("passes cursor, direction and pageSize through", async () => {
    const opts = await callFindPage({
      cursor: "abc",
      direction: "backward",
      pageSize: 7,
    });

    expect(opts.cursor).toBe("abc");
    expect(opts.direction).toBe("backward");
    expect(opts.pageSize).toBe(7);
  });

  it("projects only the generic fields", async () => {
    const opts = await callFindPage();

    expect(opts.project).toEqual({
      _id: 1,
      messageId: 1,
      type: 1,
      source: 1,
      segregationRef: 1,
      status: 1,
      completionAttempts: 1,
      traceparent: 1,
      eventTime: 1,
      lastResubmissionDate: 1,
      completionDate: 1,
      lastError: 1,
      lastRedrive: 1,
    });
    expect(opts.project).not.toHaveProperty("event");
    expect(opts.project).not.toHaveProperty("claimedBy");
  });

  it("maps messageId to eventId", async () => {
    const row = await mapOne(aDoc({ messageId: "msg-42" }));

    expect(row.eventId).toBe("msg-42");
  });

  it("maps eventTime to createdAt", async () => {
    const row = await mapOne(aDoc({ eventTime: "2026-06-16T10:00:00.000Z" }));

    expect(row.createdAt).toBe("2026-06-16T10:00:00.000Z");
  });

  it("maps lastResubmissionDate to lastFailureAt", async () => {
    const row = await mapOne(
      aDoc({ lastResubmissionDate: "2026-06-16T10:16:05.000Z" }),
    );

    expect(row.lastFailureAt).toBe("2026-06-16T10:16:05.000Z");
  });

  it("maps completionDate to completedAt", async () => {
    const row = await mapOne(
      aDoc({ completionDate: "2026-06-16T10:20:00.000Z" }),
    );

    expect(row.completedAt).toBe("2026-06-16T10:20:00.000Z");
  });

  it("renders _id as a hex string", async () => {
    const row = await mapOne(aDoc());

    expect(row._id).toBe("665f1c2e9a1b2c3d4e5f6a7b");
  });

  it("normalises a Date eventTime to ISO", async () => {
    const row = await mapOne(
      aDoc({ eventTime: new Date("2026-06-16T10:00:00.000Z") }),
    );

    expect(row.createdAt).toBe("2026-06-16T10:00:00.000Z");
  });

  it("passes an ISO string eventTime through", async () => {
    const row = await mapOne(aDoc({ eventTime: "2026-06-16T10:00:00.000Z" }));

    expect(row.createdAt).toBe("2026-06-16T10:00:00.000Z");
  });

  it("returns null rather than undefined for absent optional fields", async () => {
    const row = await mapOne({
      _id: objectId,
      status: InboxStatus.PUBLISHED,
    });

    expect(row).toEqual({
      _id: "665f1c2e9a1b2c3d4e5f6a7b",
      eventId: null,
      type: null,
      source: null,
      segregationRef: null,
      status: InboxStatus.PUBLISHED,
      completionAttempts: null,
      traceparent: null,
      createdAt: null,
      lastFailureAt: null,
      lastError: null,
      completedAt: null,
      lastRedrive: null,
    });
  });

  it("returns the document's traceparent", async () => {
    const row = await mapOne(
      aDoc({
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      }),
    );

    expect(row.traceparent).toBe(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
  });

  it("returns a bare CDP request id traceparent unchanged", async () => {
    const row = await mapOne(aDoc({ traceparent: "cdp-request-id-1" }));

    expect(row.traceparent).toBe("cdp-request-id-1");
  });

  it("returns null when the document has no traceparent", async () => {
    const row = await mapOne(aDoc({ traceparent: undefined }));

    expect(row.traceparent).toBeNull();
  });

  it("returns null when the document's traceparent is null", async () => {
    const row = await mapOne(aDoc({ traceparent: null }));

    expect(row.traceparent).toBeNull();
  });

  it("never returns event or claimedBy", async () => {
    const row = await mapOne(aDoc());

    expect(row).not.toHaveProperty("event");
    expect(row).not.toHaveProperty("claimedBy");
  });

  it("encodes and decodes _id cursor values as ObjectIds", async () => {
    const opts = await callFindPage();

    expect(opts.codecs._id.encode(objectId)).toBe("665f1c2e9a1b2c3d4e5f6a7b");
    expect(opts.codecs._id.decode("665f1c2e9a1b2c3d4e5f6a7b")).toEqual(
      objectId,
    );
  });

  it("keeps eventTime cursor values as strings", async () => {
    const opts = await callFindPage();

    expect(opts.codecs.eventTime.encode("2026-06-16T10:00:00.000Z")).toBe(
      "2026-06-16T10:00:00.000Z",
    );
    expect(opts.codecs.eventTime.decode("2026-06-16T10:00:00.000Z")).toBe(
      "2026-06-16T10:00:00.000Z",
    );
  });

  it("returns the paginate result unchanged", async () => {
    const page = { data: [], pagination: { hasNextPage: false } };
    paginate.mockResolvedValue(page);

    await expect(
      findPage({ direction: "forward", pageSize: 20 }),
    ).resolves.toBe(page);
  });
});

describe("inbox.repository findPage search", () => {
  const callFindPage = async (args = {}) => {
    vi.mocked(paginate).mockResolvedValue({ data: [], pagination: {} });
    await findPage({ direction: "forward", pageSize: 20, ...args });
    return paginate.mock.calls.at(-1)[1];
  };

  const filterFor = async (args) => (await callFindPage(args)).filter;

  beforeEach(() => {
    vi.mocked(paginate).mockReset();
  });

  it("matches q against messageId, segregationRef and its prefix", async () => {
    const { $or } = await filterFor({ q: "msg-1" });

    expect($or).toContainEqual({ messageId: "msg-1" });
    expect($or).toContainEqual({ segregationRef: "msg-1" });
    expect($or).toContainEqual({
      segregationRef: { $regex: "^msg-1", $options: "i" },
    });
  });

  it("matches a 24-hex q against _id as well", async () => {
    const hex = "665f1c2e9a1b2c3d4e5f6a7b";

    expect((await filterFor({ q: hex })).$or).toContainEqual({
      _id: ObjectId.createFromHexString(hex),
    });
  });

  it("escapes regex metacharacters in q", async () => {
    expect((await filterFor({ q: "a.b+c" })).$or).toContainEqual({
      segregationRef: { $regex: "^a\\.b\\+c", $options: "i" },
    });
  });

  it("ignores an empty or whitespace-only q", async () => {
    expect(await filterFor({ q: "" })).toEqual({});
    expect(await filterFor({ q: "   " })).toEqual({});
  });

  it("combines status and q with $and", async () => {
    const filter = await filterFor({ status: "FAILED", q: "msg-1" });

    expect(filter.$and[0]).toEqual({ status: "FAILED" });
    expect(filter.$and[1]).toHaveProperty("$or");
  });

  // The TYPE filter is gone: a stray `kind` selects nothing and excludes
  // nothing.
  it("ignores a kind key rather than filtering on it", async () => {
    expect(await filterFor({ kind: "audit" })).toEqual({});
    expect(await filterFor({ kind: "domain" })).toEqual({});
  });

  it("maps a stored lastError onto the row", async () => {
    const lastError = {
      name: "ClaimExpired",
      message: "claim expired before completion",
      at: "2026-06-16T10:16:05.000Z",
    };
    const opts = await callFindPage();

    expect(
      opts.mapDocument({
        _id: new ObjectId("665f1c2e9a1b2c3d4e5f6a7b"),
        status: InboxStatus.FAILED,
        lastError,
      }).lastError,
    ).toEqual(lastError);
  });

  it("drops an extra key such as a stack from a stored lastError", async () => {
    const opts = await callFindPage();

    const row = opts.mapDocument({
      _id: new ObjectId("665f1c2e9a1b2c3d4e5f6a7b"),
      status: InboxStatus.FAILED,
      lastError: {
        name: "Error",
        message: "boom",
        at: "2026-06-16T10:16:05.000Z",
        stack: "SECRET-STACK",
      },
    });

    expect(Object.keys(row.lastError)).toEqual(["name", "message", "at"]);
  });
});

describe("inbox.repository detail and redrive", () => {
  const ID = "665f1c2e9a1b2c3d4e5f6a7b";

  const aStoredDoc = (overrides = {}) => ({
    _id: new ObjectId(ID),
    messageId: "msg-1",
    type: "cloud.defra.prd.fg-gas-backend.case.create.new",
    source: "GAS",
    segregationRef: "GLD-9B2",
    status: InboxStatus.DEAD_LETTER,
    completionAttempts: 5,
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    eventTime: "2026-06-16T10:00:00.000Z",
    publicationDate: new Date("2026-06-16T10:00:01.000Z"),
    lastResubmissionDate: null,
    completionDate: null,
    lastError: { name: "TypeError", message: "boom", at: null },
    event: { id: "evt-1", data: { clientRef: "REF-1" } },
    claimedAt: null,
    claimExpiresAt: null,
    ...overrides,
  });

  it("reads the detail by id, projecting the claim token away", async () => {
    const findOne = vi.fn().mockResolvedValue(aStoredDoc());
    db.collection.mockReturnValue({ findOne });

    await findDetailById(ID);

    expect(findOne).toHaveBeenCalledWith(
      { _id: new ObjectId(ID) },
      { projection: { claimedBy: 0 } },
    );
  });

  it("returns the full event payload on the detail", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(aStoredDoc()),
    });

    const detail = await findDetailById(ID);

    expect(detail.event).toEqual({ id: "evt-1", data: { clientRef: "REF-1" } });
  });

  it("never returns claimedBy even if the driver hands one back", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(aStoredDoc({ claimedBy: "token" })),
    });

    expect(await findDetailById(ID)).not.toHaveProperty("claimedBy");
  });

  it("stamps maxAttempts on the detail", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(aStoredDoc()),
    });

    expect((await findDetailById(ID)).maxAttempts).toBe(
      parseInt(config.get("inbox.inboxMaxRetries")),
    );
  });

  it("returns null when there is no such row", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    expect(await findDetailById(ID)).toBeNull();
  });

  it("reads only the status for the 404-vs-409 decision", async () => {
    const findOne = vi.fn().mockResolvedValue({ status: "COMPLETED" });
    db.collection.mockReturnValue({ findOne });

    expect(await findStatusById(ID)).toBe("COMPLETED");
    expect(findOne).toHaveBeenCalledWith(
      { _id: new ObjectId(ID) },
      { projection: { status: 1 } },
    );
  });

  it("returns a null status for an unknown id", async () => {
    db.collection.mockReturnValue({ findOne: vi.fn().mockResolvedValue(null) });

    expect(await findStatusById(ID)).toBeNull();
  });

  it("redrives with a single conditional update filtered on DEAD_LETTER", async () => {
    const findOneAndUpdate = vi
      .fn()
      .mockResolvedValue(
        aStoredDoc({ status: InboxStatus.RESUBMITTED, completionAttempts: 0 }),
      );
    db.collection.mockReturnValue({ findOneAndUpdate });

    await redriveById(ID);

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new ObjectId(ID), status: InboxStatus.DEAD_LETTER },
      {
        $set: {
          status: InboxStatus.RESUBMITTED,
          completionAttempts: 0,
          lastRedrive: { at: expect.any(String), by: null },
          claimedBy: null,
          claimedAt: null,
          claimExpiresAt: null,
        },
      },
      { returnDocument: "after" },
    );
  });

  it("returns the updated row in the list projection", async () => {
    db.collection.mockReturnValue({
      findOneAndUpdate: vi.fn().mockResolvedValue(
        aStoredDoc({
          status: InboxStatus.RESUBMITTED,
          completionAttempts: 0,
        }),
      ),
    });

    const row = await redriveById(ID);

    expect(row).toEqual({
      _id: ID,
      eventId: "msg-1",
      type: "cloud.defra.prd.fg-gas-backend.case.create.new",
      source: "GAS",
      segregationRef: "GLD-9B2",
      status: InboxStatus.RESUBMITTED,
      completionAttempts: 0,
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      createdAt: "2026-06-16T10:00:00.000Z",
      lastFailureAt: null,
      lastError: { name: "TypeError", message: "boom", at: null },
      completedAt: null,
      lastRedrive: null,
    });
  });

  it("carries no event payload on the redrive response", async () => {
    db.collection.mockReturnValue({
      findOneAndUpdate: vi.fn().mockResolvedValue(aStoredDoc()),
    });

    expect(await redriveById(ID)).not.toHaveProperty("event");
  });

  it("returns null when the conditional update matched nothing", async () => {
    db.collection.mockReturnValue({
      findOneAndUpdate: vi.fn().mockResolvedValue(null),
    });

    expect(await redriveById(ID)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Time range and per-status counts (the events admin surface)
// ---------------------------------------------------------------------------

const FROM = "2026-06-16T00:00:00.000Z";
const TO = "2026-06-16T23:59:59.999Z";

const mockAggregate = (rows) => {
  const aggregate = vi.fn().mockReturnValue({
    toArray: vi.fn().mockResolvedValue(rows),
  });

  db.collection.mockReturnValue({ aggregate });

  return aggregate;
};

describe("inbox.repository findPage from/to", () => {
  const filterFor = async (options) => {
    vi.mocked(paginate).mockResolvedValue({ data: [], pagination: {} });

    await findPage(options);

    return paginate.mock.calls.at(-1)[1].filter;
  };

  it("filters on eventTime, inclusive at both ends", async () => {
    expect(await filterFor({ from: FROM, to: TO })).toEqual({
      eventTime: { $gte: FROM, $lte: TO },
    });
  });

  it("accepts each bound on its own", async () => {
    expect(await filterFor({ from: FROM })).toEqual({
      eventTime: { $gte: FROM },
    });
    expect(await filterFor({ to: TO })).toEqual({
      eventTime: { $lte: TO },
    });
  });

  it("filters on nothing when no bound is given", async () => {
    expect(await filterFor({})).toEqual({});
  });

  it("combines the range with the other filters", async () => {
    expect(await filterFor({ status: "FAILED", from: FROM })).toEqual({
      $and: [{ status: "FAILED" }, { eventTime: { $gte: FROM } }],
    });
  });
});

describe("inbox.repository countFacets", () => {
  it("matches the same rows as the list and groups them by status", async () => {
    const aggregate = mockAggregate([]);

    await countFacets({ from: FROM, to: TO });

    expect(aggregate).toHaveBeenCalledWith([
      { $match: { eventTime: { $gte: FROM, $lte: TO } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
  });

  it("counts the whole box when nothing is filtered", async () => {
    const aggregate = mockAggregate([]);

    await countFacets();

    expect(aggregate.mock.calls[0][0][0]).toEqual({ $match: {} });
  });

  it("zero-fills the status block for an empty box", async () => {
    mockAggregate([]);

    expect(await countFacets()).toEqual({
      counts: {
        PUBLISHED: 0,
        PROCESSING: 0,
        FAILED: 0,
        RESUBMITTED: 0,
        COMPLETED: 0,
        DEAD_LETTER: 0,
      },
    });
  });

  it("counts the rows the $group emits into their statuses", async () => {
    mockAggregate([
      { _id: "FAILED", count: 3 },
      { _id: "DEAD_LETTER", count: 1 },
    ]);

    const { counts } = await countFacets();

    expect(counts.FAILED).toBe(3);
    expect(counts.DEAD_LETTER).toBe(1);
  });
});
describe("inbox.repository breakdown", () => {
  const mockAggregate = (rows) => {
    const aggregate = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(rows),
    });
    db.collection.mockReturnValue({ aggregate });

    return aggregate;
  };

  it("scopes itself to DEAD_LETTER, whatever the caller asked for", async () => {
    const aggregate = mockAggregate([]);

    await breakdown({ q: "GLD-9B2" });

    const [[match]] = aggregate.mock.calls;

    expect(JSON.stringify(match[0].$match)).toContain("DEAD_LETTER");
  });

  it("groups on the stored error message and the box's own type field", async () => {
    const aggregate = mockAggregate([]);

    await breakdown({});

    const [[stages]] = aggregate.mock.calls;

    expect(stages[1].$group._id).toEqual({
      error: { $ifNull: ["$lastError.message", null] },
      type: { $ifNull: ["$type", null] },
    });
  });

  it("takes first-seen and last-seen off the box's own sort key", async () => {
    const aggregate = mockAggregate([]);

    await breakdown({});

    const [[stages]] = aggregate.mock.calls;

    expect(stages[1].$group.firstAt).toEqual({ $min: "$eventTime" });
    expect(stages[1].$group.lastAt).toEqual({ $max: "$eventTime" });
  });

  it("maps the aggregation rows into groups", async () => {
    mockAggregate([
      {
        _id: { error: "boom", type: "t" },
        count: 3,
        firstAt: "2026-06-16T10:00:00.000Z",
        lastAt: "2026-06-16T11:00:00.000Z",
      },
    ]);

    expect(await breakdown({})).toEqual([
      {
        error: "boom",
        type: "t",
        count: 3,
        firstAt: "2026-06-16T10:00:00.000Z",
        lastAt: "2026-06-16T11:00:00.000Z",
      },
    ]);
  });

  it("keeps a null-error group rather than dropping it", async () => {
    mockAggregate([{ _id: { error: null, type: null }, count: 2 }]);

    const [group] = await breakdown({});

    expect(group.error).toBeNull();
    expect(group.count).toBe(2);
  });
});
