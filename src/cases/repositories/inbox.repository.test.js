import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { STAMPED_FIELDS } from "../../events/stamps.js";
import { Inbox, InboxStatus } from "../models/inbox.js";
import {
  claimEvents,
  editPayloadById,
  findByMessageId,
  findDetailById,
  findNextMessage,
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

  it("claims in the sender's eventTime order, not publicationDate", async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue(null);
    db.collection.mockReturnValue({ findOneAndUpdate });

    await claimEvents(randomUUID(), "ref-1", 1);

    expect(findOneAndUpdate.mock.calls[0][2]).toEqual({
      sort: { eventTime: 1 },
      returnDocument: "after",
    });
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
        status: {
          $nin: [
            InboxStatus.DEAD_LETTER,
            InboxStatus.COMPLETED,
            InboxStatus.PURGED,
          ],
        },
      },
      {
        $set: {
          status: InboxStatus.FAILED,
          lastError: {
            name: "ClaimExpired",
            message: "claim expired before completion",
            at: expect.any(String),
          },
          errorKey: "ClaimExpired: claim expired before completion",
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
                stack: null,
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
        status: {
          $nin: [
            InboxStatus.DEAD_LETTER,
            InboxStatus.COMPLETED,
            InboxStatus.PURGED,
          ],
        },
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

// Only the inbox's own wiring: the shared queries are tested once, in
// actuator-box.repository.test.js.
// An edit's fields are in no model, so the poller's `$set` never names them
// and a handler finishing on an edited row cannot erase the edit.
describe("inbox.repository update and an edited row", () => {
  it("leaves lastEdit, originalPayload and payloadRevision alone", async () => {
    const updateOne = vi.fn();
    db.collection.mockReturnValue({ updateOne });

    const inbox = Inbox.fromDocument({
      _id: new ObjectId(),
      source: "GAS",
      type: "t",
      segregationRef: "ref",
      status: InboxStatus.COMPLETED,
      event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: {} },
      lastEdit: { at: "2026-06-16T11:00:00.000Z", by: "ada", note: "why" },
      originalPayload: { id: "evt-1", data: { amount: "12" } },
      payloadRevision: 2,
    });

    await update(inbox, "claim");

    const [, { $set }] = updateOne.mock.calls.at(-1);

    expect($set).not.toHaveProperty("lastEdit");
    expect($set).not.toHaveProperty("originalPayload");
    expect($set).not.toHaveProperty("payloadRevision");
  });

  it("sends no stamped field", async () => {
    const updateOne = vi.fn();
    db.collection.mockReturnValue({ updateOne });

    const inbox = Inbox.fromDocument({
      _id: new ObjectId(),
      source: "GAS",
      type: "t",
      segregationRef: "ref",
      status: InboxStatus.COMPLETED,
      event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: {} },
      eventType: "case.status.updated",
      refs: ["ref:abc-123"],
    });

    await update(inbox, "claim");

    const [, { $set }] = updateOne.mock.calls.at(-1);

    expect(Object.keys($set)).toContain("status");
    expect(
      Object.keys($set).filter((key) => STAMPED_FIELDS.includes(key)),
    ).toEqual([]);
  });
});

describe("inbox.repository actuator wiring", () => {
  const ID = "665f1c2e9a1b2c3d4e5f6a7b";

  const aDoc = (overrides = {}) => ({
    _id: new ObjectId(ID),
    messageId: "msg-1",
    type: "cloud.defra.prd.fg-gas-backend.case.create.new",
    source: "GAS",
    segregationRef: "GLD-9B2",
    status: InboxStatus.DEAD_LETTER,
    completionAttempts: 5,
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    eventTime: "2026-06-16T09:59:00.000Z",
    publicationDate: "2026-06-16T10:00:00.000Z",
    lastResubmissionDate: "2026-06-16T10:05:00.000Z",
    completionDate: null,
    lastError: { name: "TypeError", message: "boom", at: null },
    event: { id: "evt-1" },
    ...overrides,
  });

  it("stamps the inbox retry cap on the detail", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(aDoc()),
    });

    expect((await findDetailById(ID)).maxAttempts).toBe(
      parseInt(config.get("inbox.inboxMaxRetries")),
    );
  });

  it("redrives into the inbox's RESUBMITTED status", async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
    db.collection.mockReturnValue({ updateOne });

    expect(await redriveById(ID)).toBe(true);
    expect(updateOne.mock.calls[0][1].$set.status).toBe(
      InboxStatus.RESUBMITTED,
    );
  });
});

// The claim order reads `eventTime` and the list reads `type`, so an edited
// envelope moves both at once rather than at the next poller save.
describe("inbox.repository editPayloadById", () => {
  it("re-derives type and eventTime from the new envelope", async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
    db.collection.mockReturnValue({ updateOne });

    await editPayloadById("665f1c2e9a1b2c3d4e5f6a7b", {
      event: { id: "evt-1", type: "t.new", time: "2026-06-17T09:00:00.000Z" },
      by: "ada",
      note: "why",
      revision: 1,
    });

    const [, { $set }] = updateOne.mock.calls.at(-1);

    expect($set.type).toBe("t.new");
    expect($set.eventTime).toBe("2026-06-17T09:00:00.000Z");
  });

  it("clears them when the new envelope has none", async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
    db.collection.mockReturnValue({ updateOne });

    await editPayloadById("665f1c2e9a1b2c3d4e5f6a7b", {
      event: { id: "evt-1" },
      revision: 1,
    });

    const [, { $set }] = updateOne.mock.calls.at(-1);

    expect($set).toMatchObject({ type: null, eventTime: null });
  });
});
