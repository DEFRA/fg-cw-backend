import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { paginate } from "../../common/paginate.js";
import { Outbox, OutboxStatus } from "../models/outbox.js";
import {
  claimEvents,
  findNextMessage,
  findPage,
  insertMany,
  update,
  updateDeadEvents,
  updateExpiredEvents,
  updateFailedEvents,
  updateResubmittedEvents,
} from "./outbox.repository.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/paginate.js");

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
            $lte: parseInt(config.get("outbox.outboxMaxRetries")),
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

      expect(mockInsertMany).toHaveBeenCalledWith(events, {
        session: mockSession,
      });
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
          status: { $nin: [OutboxStatus.COMPLETED, OutboxStatus.DEAD_LETTER] },
        },
        {
          $set: {
            status: OutboxStatus.FAILED,
            claimedAt: null,
            claimedBy: null,
            claimExpiresAt: null,
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
          $inc: { completionAttempts: 1 },
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
          status: { $ne: OutboxStatus.DEAD_LETTER },
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

describe("outbox.repository findPage", () => {
  const callFindPage = async (args = {}) => {
    paginate.mockResolvedValue({ data: [], pagination: {} });

    await findPage({ direction: "forward", pageSize: 20, ...args });

    return paginate.mock.calls.at(-1)[1];
  };

  const mapOne = async (doc, args = {}) => {
    const opts = await callFindPage(args);
    return opts.mapDocument(doc);
  };

  const objectId = new ObjectId("665f1c2e9a1b2c3d4e5f6a7c");

  const aDoc = (overrides = {}) => ({
    _id: objectId,
    event: {
      id: "9b4d2f10",
      type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    },
    target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
    segregationRef: "GLD-9B2",
    status: OutboxStatus.COMPLETED,
    completionAttempts: 1,
    publicationDate: new Date("2026-06-16T10:00:01.000Z"),
    lastResubmissionDate: null,
    completionDate: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(paginate).mockReset();
  });

  it("sorts newest first with an _id tie-break", async () => {
    const opts = await callFindPage();

    expect(opts.sort).toEqual({ publicationDate: -1, _id: -1 });
  });

  it("skips the total count", async () => {
    const opts = await callFindPage();

    expect(opts.withTotal).toBe(false);
  });

  it("filters by status when given", async () => {
    const opts = await callFindPage({ status: OutboxStatus.DEAD_LETTER });

    expect(opts.filter).toEqual({ status: OutboxStatus.DEAD_LETTER });
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

  it("projects only event.id, event.type, event.audit.entities and event.traceparent", async () => {
    const opts = await callFindPage();

    expect(opts.project).toEqual({
      _id: 1,
      "event.id": 1,
      "event.type": 1,
      "event.audit.entities": 1,
      "event.traceparent": 1,
      target: 1,
      segregationRef: 1,
      status: 1,
      completionAttempts: 1,
      publicationDate: 1,
      lastResubmissionDate: 1,
      completionDate: 1,
    });
    expect(opts.project).not.toHaveProperty("event");
    expect(opts.project).not.toHaveProperty("event.data");
    expect(opts.project).not.toHaveProperty("event.audit.details");
    expect(opts.project).not.toHaveProperty("claimedBy");
  });

  it("projects no event key beyond id, type, audit.entities and traceparent", async () => {
    const opts = await callFindPage();

    const eventKeys = Object.keys(opts.project).filter((k) =>
      k.startsWith("event"),
    );

    expect(eventKeys).toEqual([
      "event.id",
      "event.type",
      "event.audit.entities",
      "event.traceparent",
    ]);
  });

  it("maps a CloudEvent row to eventId and type", async () => {
    const row = await mapOne(aDoc());

    expect(row.eventId).toBe("9b4d2f10");
    expect(row.type).toBe("cloud.defra.prd.fg-cw-backend.case.status.updated");
  });

  it("maps an audit row to null eventId, null type and its audit entities", async () => {
    const row = await mapOne(
      aDoc({
        event: {
          audit: {
            entities: [
              {
                entity: "CASE",
                action: "CREATE_CASE",
                entityid: "665f1c2e9a1b2c3d4e5f6a7b",
              },
            ],
          },
        },
      }),
    );

    expect(row.eventId).toBeNull();
    expect(row.type).toBeNull();
    expect(row.auditEntities).toEqual([
      { entity: "CASE", action: "CREATE_CASE" },
    ]);
  });

  it("strips entityid from every audit entity", async () => {
    const row = await mapOne(
      aDoc({
        event: {
          audit: {
            entities: [
              {
                entity: "CASE",
                action: "CREATE_CASE",
                entityid: "665f1c2e9a1b2c3d4e5f6a7b",
              },
            ],
          },
        },
      }),
    );

    expect(row.auditEntities).toEqual([
      { entity: "CASE", action: "CREATE_CASE" },
    ]);
    expect(Object.keys(row.auditEntities[0])).toEqual(["entity", "action"]);
  });

  it("keeps an empty audit entities array as an array, not null", async () => {
    const row = await mapOne(aDoc({ event: { audit: { entities: [] } } }));

    expect(row.auditEntities).toEqual([]);
  });

  it("returns null auditEntities for a CloudEvent row", async () => {
    const row = await mapOne(aDoc());

    expect(row.auditEntities).toBeNull();
  });

  it("never returns audit details", async () => {
    const row = await mapOne(
      aDoc({
        event: {
          audit: {
            entities: [{ entity: "CASE", action: "VIEW_CASE_LIST" }],
            details: { query: { page: 1 }, security: { user: "someone" } },
          },
        },
      }),
    );

    expect(JSON.stringify(row)).not.toMatch(/details/);
  });

  it("returns the raw target ARN unmodified", async () => {
    const row = await mapOne(aDoc());

    expect(row.target).toBe(
      "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
    );
  });

  it("renders _id as a hex string", async () => {
    const row = await mapOne(aDoc());

    expect(row._id).toBe("665f1c2e9a1b2c3d4e5f6a7c");
  });

  it("converts a Date publicationDate to an ISO string", async () => {
    const row = await mapOne(
      aDoc({ publicationDate: new Date("2026-06-16T10:00:01.000Z") }),
    );

    expect(row.createdAt).toBe("2026-06-16T10:00:01.000Z");
  });

  it("returns null rather than undefined for absent optional fields", async () => {
    const row = await mapOne({
      _id: objectId,
      status: OutboxStatus.PUBLISHED,
    });

    expect(row).toEqual({
      _id: "665f1c2e9a1b2c3d4e5f6a7c",
      eventId: null,
      type: null,
      auditEntities: null,
      target: null,
      segregationRef: null,
      status: OutboxStatus.PUBLISHED,
      completionAttempts: null,
      traceparent: null,
      createdAt: null,
      lastFailureAt: null,
      completedAt: null,
    });
  });

  it("lifts event.traceparent to a top-level traceparent", async () => {
    const row = await mapOne(aDoc());

    expect(row.traceparent).toBe(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
  });

  it("returns a bare CDP request id traceparent unchanged", async () => {
    const row = await mapOne(
      aDoc({ event: { id: "9b4d2f10", traceparent: "cdp-request-id-1" } }),
    );

    expect(row.traceparent).toBe("cdp-request-id-1");
  });

  it("returns a null traceparent for an audit row", async () => {
    const row = await mapOne(
      aDoc({
        event: {
          audit: {
            entities: [{ entity: "CASE", action: "VIEW_CASE_LIST" }],
            details: { security: { user: "someone" } },
          },
          correlationid: "d0f7b2a4-1111-2222-3333-444455556666",
        },
      }),
    );

    expect(row.traceparent).toBeNull();
  });

  it("never uses an audit correlationid as the traceparent", async () => {
    const row = await mapOne(
      aDoc({
        event: {
          audit: { entities: [] },
          correlationid: "d0f7b2a4-1111-2222-3333-444455556666",
        },
      }),
    );

    expect(JSON.stringify(row)).not.toMatch(/d0f7b2a4/);
  });

  it("returns null when the event carries no traceparent", async () => {
    const row = await mapOne(aDoc({ event: { id: "9b4d2f10" } }));

    expect(row.traceparent).toBeNull();
  });

  it("never returns event or claimedBy", async () => {
    const row = await mapOne(aDoc());

    expect(row).not.toHaveProperty("event");
    expect(row).not.toHaveProperty("claimedBy");
  });

  it("encodes and decodes _id cursor values as ObjectIds", async () => {
    const opts = await callFindPage();

    expect(opts.codecs._id.encode(objectId)).toBe("665f1c2e9a1b2c3d4e5f6a7c");
    expect(opts.codecs._id.decode("665f1c2e9a1b2c3d4e5f6a7c")).toEqual(
      objectId,
    );
  });

  it("encodes and decodes publicationDate cursor values as Dates", async () => {
    const opts = await callFindPage();
    const date = new Date("2026-06-16T10:00:01.000Z");

    expect(opts.codecs.publicationDate.encode(date)).toBe(
      "2026-06-16T10:00:01.000Z",
    );
    expect(
      opts.codecs.publicationDate.decode("2026-06-16T10:00:01.000Z"),
    ).toEqual(date);
  });

  it("returns the paginate result unchanged", async () => {
    const page = { data: [], pagination: { hasNextPage: false } };
    paginate.mockResolvedValue(page);

    await expect(
      findPage({ direction: "forward", pageSize: 20 }),
    ).resolves.toBe(page);
  });
});
