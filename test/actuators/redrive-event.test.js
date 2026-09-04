import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { redriveInboxEvent, redriveOutboxEvent } from "../helpers/actuators.js";

let client;
let inbox;
let outbox;

const UNKNOWN_ID = "665f1c2e9a1b2c3d4e5f6aaa";
const MAX_RETRIES = 5;

const bodyOf = (error) => {
  const payload = error.data?.payload;

  return Buffer.isBuffer(payload) ? JSON.parse(payload.toString()) : payload;
};

const aDeadInboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  // a segregationRef nothing else uses, so the poller cannot claim it out
  // from under the assertions before they run
  segregationRef: `REDRIVE-${new ObjectId().toHexString()}`,
  status: "DEAD_LETTER",
  completionAttempts: MAX_RETRIES,
  eventTime: "2026-06-16T10:00:00.000Z",
  lastResubmissionDate: "2026-06-16T10:05:00.000Z",
  completionDate: null,
  lastError: {
    name: "TypeError",
    message: "boom",
    at: "2026-06-16T10:05:00.000Z",
  },
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: {} },
  ...overrides,
});

const aDeadOutboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case_fifo.fifo",
  segregationRef: `REDRIVE-${new ObjectId().toHexString()}`,
  status: "DEAD_LETTER",
  completionAttempts: MAX_RETRIES,
  publicationDate: new Date("2026-06-16T10:00:00.000Z"),
  lastResubmissionDate: "2026-06-16T10:05:00.000Z",
  completionDate: null,
  lastError: null,
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-2", type: "cloud.defra.prd.fg-cw-backend.x", data: {} },
  ...overrides,
});

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  inbox = client.db().collection("inbox");
  outbox = client.db().collection("outbox");
});

afterAll(async () => {
  await client?.close(true);
});

describe("POST /actuators/inbox/{id}/redrive", () => {
  it("rejects a request with no token", async () => {
    await expect(redriveInboxEvent(UNKNOWN_ID, {}, null)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("rejects an id that is not a 24-hex ObjectId with 400", async () => {
    await expect(redriveInboxEvent("nope")).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
  });

  it("404s for an id that does not exist", async () => {
    await expect(redriveInboxEvent(UNKNOWN_ID)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });

  it("returns the updated list row", async () => {
    const doc = aDeadInboxDoc();
    await inbox.insertOne(doc);

    const { payload } = await redriveInboxEvent(doc._id.toHexString());

    expect(payload._id).toBe(doc._id.toHexString());
    expect(payload.status).toBe("RESUBMITTED");
    expect(payload.completionAttempts).toBe(0);
    expect(payload.maxAttempts).toBe(MAX_RETRIES);
  });

  it("carries no event payload on the redrive response", async () => {
    const doc = aDeadInboxDoc();
    await inbox.insertOne(doc);

    const { payload } = await redriveInboxEvent(doc._id.toHexString());

    expect(payload).not.toHaveProperty("event");
    expect(payload).not.toHaveProperty("claimedBy");
  });

  it("resets the attempt counter and releases the claim in the database", async () => {
    const doc = aDeadInboxDoc({ claimedBy: "stale", claimedAt: new Date() });
    await inbox.insertOne(doc);

    await redriveInboxEvent(doc._id.toHexString());

    const stored = await inbox.findOne({ _id: doc._id });

    expect(stored.completionAttempts).toBe(0);
    expect(stored.claimedBy).toBeNull();
    expect(stored.claimedAt).toBeNull();
    expect(stored.claimExpiresAt).toBeNull();
  });

  it("keeps lastError and lastResubmissionDate", async () => {
    const doc = aDeadInboxDoc();
    await inbox.insertOne(doc);

    const { payload } = await redriveInboxEvent(doc._id.toHexString());

    expect(payload.lastError.name).toBe("TypeError");
    expect(payload.lastFailureAt).toBe("2026-06-16T10:05:00.000Z");
  });

  it("409s with the current status when the row is not DEAD_LETTER", async () => {
    const doc = aDeadInboxDoc({ status: "COMPLETED" });
    await inbox.insertOne(doc);

    const error = await redriveInboxEvent(doc._id.toHexString()).catch(
      (e) => e,
    );

    expect(error.output.statusCode).toBe(409);
    expect(bodyOf(error).status).toBe("COMPLETED");
  });

  it("leaves a non-DEAD_LETTER row untouched", async () => {
    const doc = aDeadInboxDoc({ status: "COMPLETED" });
    await inbox.insertOne(doc);

    await redriveInboxEvent(doc._id.toHexString()).catch(() => {});

    const stored = await inbox.findOne({ _id: doc._id });

    expect(stored.status).toBe("COMPLETED");
    expect(stored.completionAttempts).toBe(MAX_RETRIES);
  });

  it("409s on a second redrive - the update is the precondition", async () => {
    const doc = aDeadInboxDoc();
    await inbox.insertOne(doc);

    await redriveInboxEvent(doc._id.toHexString());
    const error = await redriveInboxEvent(doc._id.toHexString()).catch(
      (e) => e,
    );

    expect(error.output.statusCode).toBe(409);
  });
});

describe("POST /actuators/outbox/{id}/redrive", () => {
  it("404s for an id that does not exist", async () => {
    await expect(redriveOutboxEvent(UNKNOWN_ID)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });

  it("returns the updated list row with the attempt counter reset", async () => {
    const doc = aDeadOutboxDoc();
    await outbox.insertOne(doc);

    const { payload } = await redriveOutboxEvent(doc._id.toHexString());

    expect(payload.status).toBe("RESUBMITTED");
    expect(payload.completionAttempts).toBe(0);
    expect(payload.target).toBe(
      "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case_fifo.fifo",
    );
  });

  it("409s with the current status when the row is not DEAD_LETTER", async () => {
    const doc = aDeadOutboxDoc({ status: "PUBLISHED" });
    await outbox.insertOne(doc);

    const error = await redriveOutboxEvent(doc._id.toHexString()).catch(
      (e) => e,
    );

    expect(error.output.statusCode).toBe(409);
    expect(bodyOf(error).status).toBe("PUBLISHED");
  });
});
