import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getInboxEvent, getOutboxEvent } from "../helpers/actuators.js";
import { TestUser, getTokenFor } from "../helpers/users.js";

let client;
let inbox;
let outbox;

const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");
const UNKNOWN_ID = "665f1c2e9a1b2c3d4e5f6aaa";

// held claims with a far-future expiry keep the pollers away from the fixtures
const anInboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: "GLD-9B2-BWS-grasslands",
  status: "COMPLETED",
  completionAttempts: 3,
  eventTime: "2026-06-16T10:00:00.000Z",
  publicationDate: "2026-06-16T10:00:01.000Z",
  lastResubmissionDate: "2026-06-16T10:05:00.000Z",
  completionDate: "2026-06-16T10:06:00.000Z",
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  lastError: {
    name: "TypeError",
    message: "boom",
    at: "2026-06-16T10:05:00.000Z",
  },
  claimedBy: "test-holder",
  claimedAt: new Date(),
  claimExpiresAt: FAR_FUTURE,
  event: {
    id: "evt-1",
    time: "2026-06-16T10:00:00.000Z",
    data: { clientRef: "CLIENT-REF-1", nested: { deep: true } },
  },
  ...overrides,
});

const anOutboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case_fifo.fifo",
  segregationRef: "GLD-9B2-BWS-grasslands",
  status: "COMPLETED",
  completionAttempts: 2,
  publicationDate: new Date("2026-06-16T10:00:00.000Z"),
  lastResubmissionDate: null,
  completionDate: "2026-06-16T10:06:00.000Z",
  lastError: null,
  claimedBy: "test-holder",
  claimedAt: new Date(),
  claimExpiresAt: FAR_FUTURE,
  event: {
    id: "evt-2",
    type: "cloud.defra.prd.fg-cw-backend.case.stage.updated",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    data: { caseRef: "CASE-REF-1" },
  },
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

describe("GET /actuators/inbox/{id}", () => {
  it("rejects a request with no token", async () => {
    await expect(getInboxEvent(UNKNOWN_ID, null)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("rejects a valid Entra user token", async () => {
    const token = await getTokenFor(TestUser.Admin.email);

    await expect(getInboxEvent(UNKNOWN_ID, `Bearer ${token}`)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("rejects an id that is not a 24-hex ObjectId with 400", async () => {
    await expect(getInboxEvent("nope")).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
  });

  it("404s for an id that does not exist", async () => {
    await expect(getInboxEvent(UNKNOWN_ID)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });

  it("returns the whole document including the event payload", async () => {
    const doc = anInboxDoc();
    await inbox.insertOne(doc);

    const { payload } = await getInboxEvent(doc._id.toHexString());

    expect(payload._id).toBe(doc._id.toHexString());
    expect(payload.messageId).toBe(doc.messageId);
    expect(payload.event).toEqual(doc.event);
    expect(payload.event.data.nested).toEqual({ deep: true });
  });

  it("never returns the claim token", async () => {
    const doc = anInboxDoc();
    await inbox.insertOne(doc);

    const { payload } = await getInboxEvent(doc._id.toHexString());

    expect(payload).not.toHaveProperty("claimedBy");
    expect(JSON.stringify(payload)).not.toContain("test-holder");
  });

  it("returns the claim window, dates, lastError and maxAttempts", async () => {
    const doc = anInboxDoc();
    await inbox.insertOne(doc);

    const { payload } = await getInboxEvent(doc._id.toHexString());

    expect(payload.maxAttempts).toBe(5);
    expect(payload.completionAttempts).toBe(3);
    expect(payload.lastResubmissionDate).toBe("2026-06-16T10:05:00.000Z");
    expect(payload.completionDate).toBe("2026-06-16T10:06:00.000Z");
    expect(payload.claimExpiresAt).toBe(FAR_FUTURE.toISOString());
    expect(payload.lastError.name).toBe("TypeError");
    expect(payload.traceparent).toBe(doc.traceparent);
  });
});

describe("GET /actuators/outbox/{id}", () => {
  it("404s for an id that does not exist", async () => {
    await expect(getOutboxEvent(UNKNOWN_ID)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });

  it("returns the whole document including the event payload", async () => {
    const doc = anOutboxDoc();
    await outbox.insertOne(doc);

    const { payload } = await getOutboxEvent(doc._id.toHexString());

    expect(payload.event).toEqual(doc.event);
    expect(payload.event.data).toEqual({ caseRef: "CASE-REF-1" });
  });

  it("returns the full target ARN, not the topic name", async () => {
    const doc = anOutboxDoc();
    await outbox.insertOne(doc);

    const { payload } = await getOutboxEvent(doc._id.toHexString());

    expect(payload.target).toBe(
      "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case_fifo.fifo",
    );
  });

  it("never returns the claim token", async () => {
    const doc = anOutboxDoc();
    await outbox.insertOne(doc);

    const { payload } = await getOutboxEvent(doc._id.toHexString());

    expect(payload).not.toHaveProperty("claimedBy");
  });

  it("renders publicationDate as an ISO string", async () => {
    const doc = anOutboxDoc();
    await outbox.insertOne(doc);

    const { payload } = await getOutboxEvent(doc._id.toHexString());

    expect(payload.publicationDate).toBe("2026-06-16T10:00:00.000Z");
  });
});
