import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  parkInboxEvent,
  parkOutboxEvent,
  redriveInboxEvent,
  unparkInboxEvent,
  unparkOutboxEvent,
} from "../helpers/actuators.js";

// NOTE - this suite is written against the same running stack the rest of
// test/actuators/ uses. It could not be executed here: the integration
// harness's ports are blocked in this environment, so it is committed unrun
// alongside the unit tests that DO cover the same behaviour
// (src/common/event-park.test.js proves the poller can never touch a PARKED
// row, and the route/use-case tests cover the 404/409 preconditions).

let client;
let inbox;
let outbox;

const UNKNOWN_ID = "665f1c2e9a1b2c3d4e5f6aaa";
const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");

const aDeadInboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-park-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: `PARK-${new ObjectId().toHexString()}`,
  status: "DEAD_LETTER",
  completionAttempts: 5,
  eventTime: "2026-06-16T10:00:00.000Z",
  lastResubmissionDate: "2026-06-16T10:05:00.000Z",
  completionDate: null,
  lastError: { name: "TypeError", message: "boom", at: null },
  attemptHistory: [],
  parked: null,
  lastRedrive: null,
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-park-1", time: "2026-06-16T10:00:00.000Z", data: {} },
  ...overrides,
});

const aDeadOutboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_updated.fifo",
  segregationRef: `PARK-${new ObjectId().toHexString()}`,
  status: "DEAD_LETTER",
  completionAttempts: 5,
  publicationDate: new Date("2026-06-16T10:00:00.000Z"),
  lastResubmissionDate: "2026-06-16T10:05:00.000Z",
  completionDate: null,
  lastError: { name: "TypeError", message: "boom", at: null },
  attemptHistory: [],
  parked: null,
  lastRedrive: null,
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: {
    id: `evt-park-${new ObjectId().toHexString()}`,
    type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
    time: "2026-06-16T10:00:00.000Z",
    data: {},
  },
  ...overrides,
});

const insertInbox = async (overrides) => {
  const doc = aDeadInboxDoc(overrides);
  await inbox.insertOne(doc);

  return doc;
};

const insertOutbox = async (overrides) => {
  const doc = aDeadOutboxDoc(overrides);
  await outbox.insertOne(doc);

  return doc;
};

const reload = (collection, doc) => collection.findOne({ _id: doc._id });

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  inbox = client.db().collection("inbox");
  outbox = client.db().collection("outbox");
});

afterAll(async () => {
  await client?.close(true);
});

describe("POST /actuators/{box}/{id}/park", () => {
  it("moves a DEAD_LETTER inbox row to PARKED and records the reason and actor", async () => {
    const doc = await insertInbox();

    const { payload } = await parkInboxEvent(doc._id.toHexString(), {
      reason: "poison payload",
      by: "donatas",
    });

    expect(payload.status).toBe("PARKED");
    expect(payload.parked).toEqual({
      at: expect.any(String),
      reason: "poison payload",
      by: "donatas",
    });

    const stored = await reload(inbox, doc);

    expect(stored.status).toBe("PARKED");
    expect(stored.parked.reason).toBe("poison payload");
    expect(stored.parked.by).toBe("donatas");
  });

  it("does the same for an outbox row", async () => {
    const doc = await insertOutbox();

    const { payload } = await parkOutboxEvent(doc._id.toHexString(), {
      reason: "poison payload",
    });

    expect(payload.status).toBe("PARKED");
    expect(payload.parked.by).toBeNull();
  });

  it("leaves the attempts, the error and the history alone", async () => {
    const doc = await insertInbox({
      attemptHistory: [{ at: null, name: "TypeError", message: "boom" }],
    });

    await parkInboxEvent(doc._id.toHexString(), { reason: "poison" });

    const stored = await reload(inbox, doc);

    expect(stored.completionAttempts).toBe(5);
    expect(stored.lastError.message).toBe("boom");
    expect(stored.attemptHistory).toHaveLength(1);
  });

  it("is a 409 when the row is not DEAD_LETTER", async () => {
    const doc = await insertInbox({
      status: "COMPLETED",
      claimExpiresAt: FAR_FUTURE,
    });

    await expect(
      parkInboxEvent(doc._id.toHexString(), { reason: "poison" }),
    ).rejects.toThrow(/409/);
  });

  it("is a 404 for an id that does not exist", async () => {
    await expect(
      parkInboxEvent(UNKNOWN_ID, { reason: "poison" }),
    ).rejects.toThrow(/404/);
  });

  it("is a 400 without a reason", async () => {
    const doc = await insertInbox();

    await expect(parkInboxEvent(doc._id.toHexString(), {})).rejects.toThrow(
      /400/,
    );
  });

  it("is a 401 without a bearer token", async () => {
    const doc = await insertInbox();

    await expect(
      parkInboxEvent(doc._id.toHexString(), { reason: "poison" }, null),
    ).rejects.toThrow(/401/);
  });
});

describe("POST /actuators/{box}/{id}/unpark", () => {
  it("moves a PARKED row back to DEAD_LETTER and clears the record", async () => {
    const doc = await insertInbox();
    await parkInboxEvent(doc._id.toHexString(), { reason: "poison" });

    const { payload } = await unparkInboxEvent(doc._id.toHexString(), {
      by: "donatas",
    });

    expect(payload.status).toBe("DEAD_LETTER");
    expect(payload.parked).toBeNull();

    const stored = await reload(inbox, doc);

    expect(stored.status).toBe("DEAD_LETTER");
    expect(stored.parked).toBeNull();
  });

  it("does the same for an outbox row", async () => {
    const doc = await insertOutbox();
    await parkOutboxEvent(doc._id.toHexString(), { reason: "poison" });

    const { payload } = await unparkOutboxEvent(doc._id.toHexString());

    expect(payload.status).toBe("DEAD_LETTER");
  });

  it("does NOT retry the row - a redrive is the separate, explicit next step", async () => {
    const doc = await insertInbox();
    await parkInboxEvent(doc._id.toHexString(), { reason: "poison" });
    await unparkInboxEvent(doc._id.toHexString());

    const stored = await reload(inbox, doc);

    expect(stored.completionAttempts).toBe(5);
    expect(stored.lastError.message).toBe("boom");
  });

  it("is a 409 when the row is not PARKED", async () => {
    const doc = await insertInbox();

    await expect(unparkInboxEvent(doc._id.toHexString())).rejects.toThrow(
      /409/,
    );
  });

  it("is a 404 for an id that does not exist", async () => {
    await expect(unparkInboxEvent(UNKNOWN_ID)).rejects.toThrow(/404/);
  });
});

describe("park / unpark / redrive lifecycle", () => {
  it("parks, unparks and then redrives one row back into the poller's hands", async () => {
    const doc = await insertInbox();
    const id = doc._id.toHexString();

    await parkInboxEvent(id, { reason: "poison", by: "donatas" });
    expect((await reload(inbox, doc)).status).toBe("PARKED");

    await unparkInboxEvent(id);
    expect((await reload(inbox, doc)).status).toBe("DEAD_LETTER");

    await redriveInboxEvent(id, { by: "donatas" });

    const redriven = await reload(inbox, doc);

    expect(redriven.status).toBe("RESUBMITTED");
    expect(redriven.completionAttempts).toBe(0);
    expect(redriven.lastRedrive).toEqual({
      at: expect.any(String),
      by: "donatas",
    });
  });

  it("a parked row is never claimed, resubmitted or re-dead-lettered by the poller", async () => {
    const doc = await insertInbox();
    await parkInboxEvent(doc._id.toHexString(), { reason: "poison" });

    // several poll intervals - the pollers run continuously in this stack
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const stored = await reload(inbox, doc);

    expect(stored.status).toBe("PARKED");
    expect(stored.claimedBy).toBeNull();
    expect(stored.completionAttempts).toBe(5);
  });
});
