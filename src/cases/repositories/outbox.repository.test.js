import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { paginate } from "../../common/paginate.js";
import { Outbox, OutboxStatus } from "../models/outbox.js";
import {
  breakdown,
  claimEvents,
  countFacets,
  findDetailById,
  findNextMessage,
  findPage,
  findStatusById,
  insertMany,
  parkById,
  redriveById,
  unparkById,
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
            lastError: null,
            attemptHistory: [],
            parked: null,
            lastRedrive: null,
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
              OutboxStatus.PARKED,
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
          status: { $nin: [OutboxStatus.DEAD_LETTER, OutboxStatus.PARKED] },
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

  it("projects only event.id, event.type and event.traceparent", async () => {
    const opts = await callFindPage();

    expect(opts.project).toEqual({
      _id: 1,
      "event.id": 1,
      "event.type": 1,
      "event.traceparent": 1,
      target: 1,
      segregationRef: 1,
      status: 1,
      completionAttempts: 1,
      publicationDate: 1,
      lastResubmissionDate: 1,
      completionDate: 1,
      lastError: 1,
      parked: 1,
      lastRedrive: 1,
    });
    expect(opts.project).not.toHaveProperty("event");
    expect(opts.project).not.toHaveProperty("event.data");
    expect(opts.project).not.toHaveProperty("event.audit");
    expect(opts.project).not.toHaveProperty("event.audit.entities");
    expect(opts.project).not.toHaveProperty("event.audit.details");
    expect(opts.project).not.toHaveProperty("claimedBy");
  });

  it("projects no event key beyond id, type and traceparent", async () => {
    const opts = await callFindPage();

    const eventKeys = Object.keys(opts.project).filter((k) =>
      k.startsWith("event"),
    );

    expect(eventKeys).toEqual(["event.id", "event.type", "event.traceparent"]);
  });

  it("maps a CloudEvent row to eventId and type", async () => {
    const row = await mapOne(aDoc());

    expect(row.eventId).toBe("9b4d2f10");
    expect(row.type).toBe("cloud.defra.prd.fg-cw-backend.case.status.updated");
  });

  // An audit record is not a CloudEvent: it stores no id and no type, so both
  // are null. Nothing about its audit-ness is carried onto the row - there is
  // no `auditEntities`, and the entities are not projected at all.
  it("maps an audit row to a null eventId and a null type, and no audit keys", async () => {
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
    expect(row).not.toHaveProperty("auditEntities");
    expect(JSON.stringify(row)).not.toMatch(/CREATE_CASE|entityid/);
  });

  it("carries no audit entities on a CloudEvent row either", async () => {
    const row = await mapOne(aDoc());

    expect(row).not.toHaveProperty("auditEntities");
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
      target: null,
      segregationRef: null,
      status: OutboxStatus.PUBLISHED,
      completionAttempts: null,
      traceparent: null,
      createdAt: null,
      lastFailureAt: null,
      lastError: null,
      completedAt: null,
      parked: null,
      lastRedrive: null,
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

describe("outbox.repository findPage search", () => {
  const callFindPage = async (args = {}) => {
    vi.mocked(paginate).mockResolvedValue({ data: [], pagination: {} });
    await findPage({ direction: "forward", pageSize: 20, ...args });
    return paginate.mock.calls.at(-1)[1];
  };

  const filterFor = async (args) => (await callFindPage(args)).filter;

  const mapOne = async (doc) => (await callFindPage()).mapDocument(doc);

  const aDoc = (overrides = {}) => ({
    _id: new ObjectId("665f1c2e9a1b2c3d4e5f6a7c"),
    event: { id: "9b4d2f10" },
    target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
    segregationRef: "GLD-9B2",
    status: OutboxStatus.FAILED,
    completionAttempts: 1,
    publicationDate: new Date("2026-06-16T10:00:01.000Z"),
    lastResubmissionDate: null,
    completionDate: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(paginate).mockReset();
  });

  it("matches q against event.id, segregationRef and its prefix", async () => {
    const { $or } = await filterFor({ q: "evt-1" });

    expect($or).toContainEqual({ "event.id": "evt-1" });
    expect($or).toContainEqual({ segregationRef: "evt-1" });
    expect($or).toContainEqual({
      segregationRef: { $regex: "^evt-1", $options: "i" },
    });
  });

  it("matches a 24-hex q against _id as well", async () => {
    const hex = "665f1c2e9a1b2c3d4e5f6a7c";

    expect((await filterFor({ q: hex })).$or).toContainEqual({
      _id: ObjectId.createFromHexString(hex),
    });
  });

  it("escapes regex metacharacters in q", async () => {
    expect((await filterFor({ q: "GLD.9B2+x" })).$or).toContainEqual({
      segregationRef: { $regex: "^GLD\\.9B2\\+x", $options: "i" },
    });
  });

  it("ignores a whitespace-only q", async () => {
    expect(await filterFor({ q: "  " })).toEqual({});
  });

  // The TYPE filter is gone: the outbox no longer splits domain from audit for
  // SELECTION, and a stray `kind` selects nothing and excludes nothing.
  it("ignores a kind key rather than filtering on it", async () => {
    expect(await filterFor({ kind: "audit" })).toEqual({});
    expect(await filterFor({ kind: "domain" })).toEqual({});
  });

  it("combines status and q with $and", async () => {
    const filter = await filterFor({ status: "FAILED", q: "evt-1" });

    expect(filter.$and).toHaveLength(2);
    expect(filter.$and[0]).toEqual({ status: "FAILED" });
  });

  it("maps a stored lastError onto the row", async () => {
    const lastError = {
      name: "TypeError",
      message: "Topic does not exist",
      at: "2026-06-16T10:16:05.000Z",
    };

    expect((await mapOne(aDoc({ lastError }))).lastError).toEqual(lastError);
  });

  it("returns a null lastError for a row that has never failed", async () => {
    expect((await mapOne(aDoc())).lastError).toBeNull();
  });

  it("rebuilds a lastError missing its name and message", async () => {
    const row = await mapOne(
      aDoc({ lastError: { at: "2026-06-16T10:16:05.000Z" } }),
    );

    expect(row.lastError).toEqual({
      name: "Error",
      message: "",
      at: "2026-06-16T10:16:05.000Z",
    });
  });
});

describe("outbox.repository detail and redrive", () => {
  const ID = "665f1c2e9a1b2c3d4e5f6a7b";

  const aStoredDoc = (overrides = {}) => ({
    _id: new ObjectId(ID),
    target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case.fifo",
    segregationRef: "GLD-9B2",
    status: OutboxStatus.DEAD_LETTER,
    completionAttempts: 5,
    publicationDate: new Date("2026-06-16T10:00:01.000Z"),
    lastResubmissionDate: null,
    completionDate: null,
    lastError: { name: "TypeError", message: "boom", at: null },
    event: {
      id: "evt-1",
      type: "cloud.defra.prd.fg-cw-backend.case.stage.updated",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      data: { clientRef: "REF-1" },
    },
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

    expect(detail.event).toEqual({
      id: "evt-1",
      type: "cloud.defra.prd.fg-cw-backend.case.stage.updated",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      data: { clientRef: "REF-1" },
    });
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
      parseInt(config.get("outbox.outboxMaxRetries")),
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
        aStoredDoc({ status: OutboxStatus.RESUBMITTED, completionAttempts: 0 }),
      );
    db.collection.mockReturnValue({ findOneAndUpdate });

    await redriveById(ID);

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new ObjectId(ID), status: OutboxStatus.DEAD_LETTER },
      {
        $set: {
          status: OutboxStatus.RESUBMITTED,
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
          status: OutboxStatus.RESUBMITTED,
          completionAttempts: 0,
        }),
      ),
    });

    const row = await redriveById(ID);

    expect(row).toEqual({
      _id: ID,
      eventId: "evt-1",
      type: "cloud.defra.prd.fg-cw-backend.case.stage.updated",
      target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case.fifo",
      segregationRef: "GLD-9B2",
      status: OutboxStatus.RESUBMITTED,
      completionAttempts: 0,
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      createdAt: "2026-06-16T10:00:01.000Z",
      lastFailureAt: null,
      lastError: { name: "TypeError", message: "boom", at: null },
      completedAt: null,
      parked: null,
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

describe("outbox.repository findPage from/to", () => {
  const filterFor = async (options) => {
    vi.mocked(paginate).mockResolvedValue({ data: [], pagination: {} });

    await findPage(options);

    return paginate.mock.calls.at(-1)[1].filter;
  };

  it("filters on publicationDate, inclusive at both ends", async () => {
    expect(await filterFor({ from: FROM, to: TO })).toEqual({
      publicationDate: { $gte: new Date(FROM), $lte: new Date(TO) },
    });
  });

  it("accepts each bound on its own", async () => {
    expect(await filterFor({ from: FROM })).toEqual({
      publicationDate: { $gte: new Date(FROM) },
    });
    expect(await filterFor({ to: TO })).toEqual({
      publicationDate: { $lte: new Date(TO) },
    });
  });

  it("filters on nothing when no bound is given", async () => {
    expect(await filterFor({})).toEqual({});
  });

  it("combines the range with the other filters", async () => {
    expect(await filterFor({ status: "FAILED", from: FROM })).toEqual({
      $and: [
        { status: "FAILED" },
        { publicationDate: { $gte: new Date(FROM) } },
      ],
    });
  });
});

describe("outbox.repository countFacets", () => {
  it("matches the same rows as the list and groups them by status", async () => {
    const aggregate = mockAggregate([]);

    await countFacets({ from: FROM, to: TO });

    expect(aggregate).toHaveBeenCalledWith([
      {
        $match: {
          publicationDate: { $gte: new Date(FROM), $lte: new Date(TO) },
        },
      },
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
        PARKED: 0,
      },
    });
  });

  it("counts the rows the $group emits into their statuses", async () => {
    mockAggregate([
      { _id: "FAILED", count: 5 },
      { _id: "COMPLETED", count: 5 },
    ]);

    const { counts } = await countFacets();

    expect(counts.FAILED).toBe(5);
    expect(counts.COMPLETED).toBe(5);
  });
});
describe("outbox.repository park and unpark", () => {
  const ID = "665f1c2e9a1b2c3d4e5f6a7b";

  it("parks with a single conditional update filtered on DEAD_LETTER", async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue(null);
    db.collection.mockReturnValue({ findOneAndUpdate });

    await parkById(ID, { reason: "poison", by: "donatas" });

    const [filter, update] = findOneAndUpdate.mock.calls[0];

    expect(filter).toEqual({
      _id: new ObjectId(ID),
      status: OutboxStatus.DEAD_LETTER,
    });
    expect(update.$set.status).toBe(OutboxStatus.PARKED);
    expect(update.$set.parked).toEqual({
      at: expect.any(String),
      reason: "poison",
      by: "donatas",
    });
  });

  it("unparks with a single conditional update filtered on PARKED", async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue(null);
    db.collection.mockReturnValue({ findOneAndUpdate });

    await unparkById(ID);

    const [filter, update] = findOneAndUpdate.mock.calls[0];

    expect(filter).toEqual({
      _id: new ObjectId(ID),
      status: OutboxStatus.PARKED,
    });
    expect(update.$set).toEqual({
      status: OutboxStatus.DEAD_LETTER,
      parked: null,
    });
  });

  it("answers null when nothing matched, so the use case can tell 404 from 409", async () => {
    db.collection.mockReturnValue({
      findOneAndUpdate: vi.fn().mockResolvedValue(null),
    });

    expect(await parkById(ID, { reason: "poison" })).toBeNull();
    expect(await unparkById(ID)).toBeNull();
  });
});

describe("outbox.repository breakdown", () => {
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
      type: { $ifNull: ["$event.type", null] },
    });
  });

  it("takes first-seen and last-seen off the box's own sort key", async () => {
    const aggregate = mockAggregate([]);

    await breakdown({});

    const [[stages]] = aggregate.mock.calls;

    expect(stages[1].$group.firstAt).toEqual({ $min: "$publicationDate" });
    expect(stages[1].$group.lastAt).toEqual({ $max: "$publicationDate" });
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
