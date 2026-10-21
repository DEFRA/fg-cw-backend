import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { STAMPED_FIELDS } from "../../events/stamps.js";
import { Outbox, OutboxStatus } from "../models/outbox.js";
import {
  claimEvents,
  editPayloadById,
  findDetailById,
  findNextMessage,
  insertMany,
  redriveById,
  update,
  updateDeadEvents,
  updateExpiredEvents,
  updateFailedEvents,
  updateResubmittedEvents,
} from "./outbox.repository.js";

vi.mock("../../common/mongo-client.js");

describe("outbox.repository", () => {
  describe("findNextMessage", () => {
    it("should find next message excluding locked segregationRefs", async () => {
      const lockIds = ["ref-a", "ref-b"];
      const mockDoc = { _id: "1", segregationRef: "ref-c" };
      const findOne = vi.fn().mockResolvedValue(mockDoc);

      db.collection.mockReturnValue({ findOne });

      const result = await findNextMessage(lockIds);

      expect(findOne).toHaveBeenCalledWith(
        {
          status: { $eq: OutboxStatus.PUBLISHED },
          claimedBy: { $eq: null },
          completionAttempts: {
            $lt: parseInt(config.get("outbox.outboxMaxRetries")),
          },
          segregationRef: { $nin: lockIds },
        },
        { sort: { publicationDate: 1 } },
      );
      expect(result).toBe(mockDoc);
    });
  });

  describe("insertMany", () => {
    it("should insert events", async () => {
      const mockInsertMany = vi.fn().mockResolvedValueOnce({
        modifiedCount: 1,
      });
      db.collection.mockReturnValue({
        insertMany: mockInsertMany,
      });

      const events = [
        new Outbox({
          target: "arn:some:arn:value",
          event: {
            clientRef: "1234-7778",
          },
          segregationRef: "test-segregation-ref-1",
        }),
        new Outbox({
          target: "arn:some:other:value",
          event: {
            clientRef: "0987-1234",
          },
          segregationRef: "test-segregation-ref-2",
        }),
      ];

      const mockSession = vi.fn();

      await insertMany(events, mockSession);

      expect(mockInsertMany).toHaveBeenCalledWith(
        events.map((event) => ({ ...event, errorKey: null })),
        {
          session: mockSession,
        },
      );
    });
  });

  describe("claimEvents", () => {
    it("should fetch any pending events", async () => {
      const claimedBy = randomUUID();
      const mockDocument = {
        _id: "1234",
        publicationDate: new Date(),
        target: "arn:an:arn:value",
        event: {
          clientRef: "1234-5668",
        },
        completionAttempts: 1,
        status: OutboxStatus.PUBLISHED,
        segregationRef: "test-segregation-ref",
      };
      const findOneAndUpdateMock = vi.fn();
      findOneAndUpdateMock
        .mockResolvedValueOnce(mockDocument)
        .mockResolvedValueOnce(null);

      db.collection.mockReturnValue({ findOneAndUpdate: findOneAndUpdateMock });

      const results = await claimEvents(claimedBy);
      expect(results[0]).toBeInstanceOf(Outbox);
      expect(results).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("calls updateOne", async () => {
      const mockUpdate = vi.fn();
      db.collection.mockReturnValue({
        updateOne: mockUpdate,
      });
      const claimedBy = randomUUID();
      const _id = randomUUID();
      const event = {};

      const outboxEvent = new Outbox({
        _id,
        event,
        publicationDate: new Date(),
        target: "arn:foo:bar",
        completionAttempts: 1,
        status: OutboxStatus.PROCESSING,
        segregationRef: "test-segregation-ref",
      });

      await update(outboxEvent, claimedBy);
      expect(mockUpdate).toHaveBeenCalledWith(
        {
          _id,
          claimedBy,
        },
        {
          $set: {
            claimExpiresAt: null,
            claimedAt: null,
            claimedBy: null,
            completionAttempts: 1,
            completionDate: undefined,
            event: {},
            lastResubmissionDate: undefined,
            lastError: null,
            errorKey: null,
            attemptHistory: [],
            lastRedrive: null,
            expireAt: null,
            publicationDate: expect.any(Date),
            status: "PROCESSING",
            target: "arn:foo:bar",
            segregationRef: expect.any(String),
          },
        },
      );
    });
  });

  describe("updateExpiredEvents", () => {
    it("should call updateMany", async () => {
      const updateMany = vi.fn().mockResolvedValue({});
      db.collection.mockReturnValue({
        updateMany,
      });

      await updateExpiredEvents();

      expect(updateMany).toHaveBeenCalledWith(
        {
          claimExpiresAt: {
            $lt: expect.any(Date),
          },
          status: {
            $nin: [
              OutboxStatus.DEAD_LETTER,
              OutboxStatus.COMPLETED,
              OutboxStatus.PURGED,
            ],
          },
        },
        {
          $set: {
            status: OutboxStatus.FAILED,
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
  });

  describe("updateFailedEvents", () => {
    it("should call updateMany", async () => {
      const updateMany = vi.fn().mockResolvedValue({});
      db.collection.mockReturnValue({
        updateMany,
      });

      await updateFailedEvents();

      expect(updateMany).toHaveBeenCalledWith(
        {
          status: OutboxStatus.FAILED,
        },
        {
          $set: {
            status: OutboxStatus.RESUBMITTED,
            claimedAt: null,
            claimedBy: null,
            claimExpiresAt: null,
          },
        },
      );
    });
  });

  describe("updateResubmittedEvents", () => {
    it("should call updateMany", async () => {
      const updateMany = vi.fn().mockResolvedValue({});
      db.collection.mockReturnValue({
        updateMany,
      });
      await updateResubmittedEvents();

      expect(updateMany).toHaveBeenCalledWith(
        {
          status: OutboxStatus.RESUBMITTED,
        },
        {
          $set: {
            status: OutboxStatus.PUBLISHED,
            claimedAt: null,
            claimExpiresAt: null,
            claimedBy: null,
          },
        },
      );
    });
  });

  describe("updateDeadEvents", () => {
    it("should call updateMany", async () => {
      const MAX_RETRIES = parseInt(config.get("outbox.outboxMaxRetries"));
      const updateMany = vi.fn().mockResolvedValue({});
      db.collection.mockReturnValue({
        updateMany,
      });
      const mockDate = new Date(20245, 10, 9);
      vi.setSystemTime(mockDate);
      await updateDeadEvents();
      expect(updateMany).toBeCalledWith(
        {
          completionAttempts: { $gte: MAX_RETRIES },
          status: {
            $nin: [
              OutboxStatus.DEAD_LETTER,
              OutboxStatus.COMPLETED,
              OutboxStatus.PURGED,
            ],
          },
        },
        {
          $set: {
            status: OutboxStatus.DEAD_LETTER,
            claimedAt: null,
            claimExpiresAt: null,
            claimedBy: null,
          },
        },
      );
    });
  });
});

// Only the outbox's own wiring: the shared queries are tested once, in
// actuator-box.repository.test.js.
// An edit's fields are in no model, so the poller's `$set` never names them
// and a handler finishing on an edited row cannot erase the edit.
describe("outbox.repository update and an edited row", () => {
  it("leaves lastEdit, originalPayload and payloadRevision alone", async () => {
    const updateOne = vi.fn();
    db.collection.mockReturnValue({ updateOne });

    const outbox = Outbox.fromDocument({
      _id: new ObjectId(),
      target: "arn:foo:bar",
      segregationRef: "ref",
      status: OutboxStatus.COMPLETED,
      event: { id: "evt-1", data: {} },
      lastEdit: { at: "2026-06-16T11:00:00.000Z", by: "ada", note: "why" },
      originalPayload: { id: "evt-1", data: { amount: "12" } },
      payloadRevision: 2,
    });

    await update(outbox, "claim");

    const [, { $set }] = updateOne.mock.calls.at(-1);

    expect($set).not.toHaveProperty("lastEdit");
    expect($set).not.toHaveProperty("originalPayload");
    expect($set).not.toHaveProperty("payloadRevision");
  });

  it("sends no stamped field", async () => {
    const updateOne = vi.fn();
    db.collection.mockReturnValue({ updateOne });

    const outbox = Outbox.fromDocument({
      _id: new ObjectId(),
      target: "arn:foo:bar",
      segregationRef: "ref",
      status: OutboxStatus.COMPLETED,
      event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: {} },
      eventType: "case.status.updated",
      refs: ["ref:abc-123"],
    });

    await update(outbox, "claim");

    const [, { $set }] = updateOne.mock.calls.at(-1);

    expect(Object.keys($set)).toContain("status");
    expect(
      Object.keys($set).filter((key) => STAMPED_FIELDS.includes(key)),
    ).toEqual([]);
  });
});

describe("outbox.repository actuator wiring", () => {
  const ID = "665f1c2e9a1b2c3d4e5f6a7c";
  const TARGET =
    "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated";

  const aDoc = (overrides = {}) => ({
    _id: new ObjectId(ID),
    event: {
      id: "9b4d2f10",
      type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      data: { clientRef: "REF-1" },
    },
    target: TARGET,
    segregationRef: "GLD-9B2",
    status: OutboxStatus.COMPLETED,
    completionAttempts: 1,
    publicationDate: new Date("2026-06-16T10:00:01.000Z"),
    lastResubmissionDate: null,
    completionDate: new Date("2026-06-16T10:00:02.000Z"),
    lastError: null,
    ...overrides,
  });

  it("stamps the outbox retry cap on the detail", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(aDoc()),
    });

    expect((await findDetailById(ID)).maxAttempts).toBe(
      parseInt(config.get("outbox.outboxMaxRetries")),
    );
  });

  it("redrives into the outbox's RESUBMITTED status", async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
    db.collection.mockReturnValue({ updateOne });

    expect(await redriveById(ID)).toBe(true);
    expect(updateOne.mock.calls[0][1].$set.status).toBe(
      OutboxStatus.RESUBMITTED,
    );
  });
});

describe("outbox.repository editPayloadById", () => {
  it("sets nothing beside the edit, having no columns derived from the payload", async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
    db.collection.mockReturnValue({ updateOne });

    await editPayloadById("665f1c2e9a1b2c3d4e5f6a7b", {
      event: { id: "evt-1", type: "t.new" },
      by: "ada",
      note: "why",
      revision: 1,
    });

    const [, { $set }] = updateOne.mock.calls.at(-1);

    expect(Object.keys($set).sort()).toEqual([
      "event",
      "lastEdit",
      "payloadRevision",
    ]);
  });
});
