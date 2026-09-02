import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { paginate } from "../../common/paginate.js";
import { Inbox, InboxStatus } from "../models/inbox.js";
import {
  claimEvents,
  findByMessageId,
  findNextMessage,
  findPage,
  insertMany,
  insertOne,
  processExpiredEvents,
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
          $lte: parseInt(config.get("inbox.inboxMaxRetries")),
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
          claimedAt: null,
          claimedBy: null,
          claimExpiresAt: null,
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
        $inc: { completionAttempts: 1 },
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
      completedAt: null,
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
