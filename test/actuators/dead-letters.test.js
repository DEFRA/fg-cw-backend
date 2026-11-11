import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedCaseReaderToken } from "../helpers/actuators.js";
import { operatorHeaders } from "../helpers/operator.js";
import { CASE_READER_TOKEN, SERVICE_TOKEN } from "../helpers/service-token.js";
import { wreck } from "../helpers/wreck.js";

let client;
let inbox;
let outbox;

// A day of its own, so no other test's rows fall in it.
const FROM = new Date("2031-03-02T00:00:00.000Z");
const TO = new Date("2031-03-03T00:00:00.000Z");
const HOUR = 60 * 60 * 1000;

const at = (hours) => new Date(FROM.getTime() + hours * HOUR);

const SEGREGATION = "dead-letter-bins";

const anOutboxRow = (hours, overrides = {}) => ({
  _id: new ObjectId(),
  target: "arn:aws:sns:eu-west-2:000000000000:some-topic",
  segregationRef: SEGREGATION,
  status: "DEAD_LETTER",
  completionAttempts: 5,
  publicationDate: at(hours),
  claimExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
  event: { id: "evt-1" },
  eventType: "CaseStatusUpdated",
  ...overrides,
});

const anInboxRow = (hours, overrides = {}) => ({
  _id: new ObjectId(),
  source: "GAS",
  segregationRef: SEGREGATION,
  status: "DEAD_LETTER",
  publicationDate: at(hours).toISOString(),
  claimExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
  messageId: "0b7c1d1e-0000-4000-8000-000000000003",
  event: { data: {} },
  eventType: "UpdateCaseStatus",
  ...overrides,
});

const countDeadLetters = (query, token = CASE_READER_TOKEN) =>
  wreck.get(`/actuators/dead-letters?${new URLSearchParams(query)}`, {
    headers: { authorization: `Bearer ${token}`, ...operatorHeaders },
  });

const window = { from: FROM.toISOString(), to: TO.toISOString() };

const countsOf = (bucket) => bucket.bins.map(({ count }) => count);

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  const db = client.db();
  inbox = db.collection("inbox");
  outbox = db.collection("outbox");
  await seedCaseReaderToken(db);
});

afterAll(async () => {
  await client?.close(true);
});

beforeEach(async () => {
  await outbox.deleteMany({ segregationRef: SEGREGATION });
  await inbox.deleteMany({ segregationRef: SEGREGATION });
});

describe("GET /actuators/dead-letters", () => {
  it("counts each box's dead letters in two-hour bins, by when each was created", async () => {
    await outbox.insertMany([
      anOutboxRow(0),
      anOutboxRow(1.99),
      anOutboxRow(2),
      anOutboxRow(23.5),
      anOutboxRow(24),
      anOutboxRow(-0.01),
      anOutboxRow(5, { status: "COMPLETED" }),
      anOutboxRow(5, { eventType: "Audit" }),
    ]);
    await inbox.insertMany([
      anInboxRow(3),
      anInboxRow(3.5),
      anInboxRow(12, { status: "FAILED" }),
    ]);

    const { payload } = await countDeadLetters(window);

    expect(payload).toMatchObject({ ...window, countCap: 10_000 });
    expect(payload.buckets.map(({ id, list }) => [id, list])).toEqual([
      [
        "cw.outbox",
        { path: "events/cw/outbox", query: { status: "DEAD_LETTER" } },
      ],
      [
        "cw.inbox",
        { path: "events/cw/inbox", query: { status: "DEAD_LETTER" } },
      ],
    ]);
    const [outboxBins, inboxBins] = payload.buckets;

    // The audit dead letter at hour 5 too, counted as the list counts it.
    expect(countsOf(outboxBins)).toEqual([2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
    expect(countsOf(inboxBins)).toEqual([0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(outboxBins.bins[0]).toEqual({
      from: "2031-03-02T00:00:00.000Z",
      to: "2031-03-02T02:00:00.000Z",
      count: 2,
      capped: false,
    });
    expect(outboxBins.bins.at(-1).to).toBe(window.to);
  });

  it("refuses a window that ends before it starts", async () => {
    const refused = await countDeadLetters({
      from: window.to,
      to: window.from,
    }).catch((error) => error);

    expect(refused.output.statusCode).toBe(400);
    expect(refused.data.payload.reason).toBe("INVALID_RANGE");
  });

  it("answers no client but fg-gas-backend", async () => {
    const refused = await countDeadLetters(window, SERVICE_TOKEN).catch(
      (error) => error,
    );

    expect(refused.output.statusCode).toBe(403);
  });
});
