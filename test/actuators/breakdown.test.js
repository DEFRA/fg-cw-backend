import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  breakdownInbox,
  breakdownOutbox,
  findInbox,
  parkInboxEvent,
} from "../helpers/actuators.js";

// NOTE - written against the same running stack the rest of test/actuators/
// uses, and committed unrun: the integration harness's ports are blocked in
// this environment. The aggregation itself is covered by
// src/common/event-breakdown.test.js and the repository tests.

let client;
let inbox;
let outbox;

const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");
const SEG = () => `BREAKDOWN-${new ObjectId().toHexString()}`;

const aDeadInboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-bd-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: SEG(),
  status: "DEAD_LETTER",
  completionAttempts: 5,
  eventTime: "2026-06-16T10:00:00.000Z",
  lastError: { name: "Error", message: "No handler found", at: null },
  attemptHistory: [],
  parked: null,
  lastRedrive: null,
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-bd", time: "2026-06-16T10:00:00.000Z", data: {} },
  ...overrides,
});

const aDeadOutboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_updated.fifo",
  segregationRef: SEG(),
  status: "DEAD_LETTER",
  completionAttempts: 5,
  publicationDate: new Date("2026-06-16T10:00:00.000Z"),
  lastError: { name: "Error", message: "publish failed", at: null },
  attemptHistory: [],
  parked: null,
  lastRedrive: null,
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: {
    id: `evt-bd-${new ObjectId().toHexString()}`,
    type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
    time: "2026-06-16T10:00:00.000Z",
    data: {},
  },
  ...overrides,
});

const groupFor = (groups, error) => groups.find((g) => g.error === error);

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  inbox = client.db().collection("inbox");
  outbox = client.db().collection("outbox");
});

afterAll(async () => {
  await client?.close(true);
});

beforeEach(async () => {
  await inbox.deleteMany({ messageId: /^msg-bd-/ });
  await outbox.deleteMany({ "event.id": /^evt-bd-/ });
});

describe("GET /actuators/inbox/breakdown", () => {
  it("groups dead letters by failure message and event type, commonest first", async () => {
    await inbox.insertMany([
      aDeadInboxDoc(),
      aDeadInboxDoc(),
      aDeadInboxDoc({
        lastError: { name: "TypeError", message: "boom", at: null },
      }),
    ]);

    const { payload } = await breakdownInbox();

    const found = groupFor(payload.groups, "No handler found");

    expect(found.count).toBeGreaterThanOrEqual(2);
    expect(found.type).toBe("cloud.defra.prd.fg-gas-backend.case.create.new");
    expect(payload.groups[0].count).toBeGreaterThanOrEqual(
      payload.groups.at(-1).count,
    );
  });

  it("returns the RAW stored type - shortening is the caller's job", async () => {
    await inbox.insertOne(aDeadInboxDoc());

    const { payload } = await breakdownInbox();

    expect(groupFor(payload.groups, "No handler found").type).toMatch(
      /^cloud\.defra\./,
    );
  });

  it("carries first-seen and last-seen off the box's own sort key", async () => {
    await inbox.insertMany([
      aDeadInboxDoc({ eventTime: "2026-06-16T09:00:00.000Z" }),
      aDeadInboxDoc({ eventTime: "2026-06-16T12:00:00.000Z" }),
    ]);

    const { payload } = await breakdownInbox();
    const group = groupFor(payload.groups, "No handler found");

    expect(group.firstAt <= group.lastAt).toBe(true);
  });

  it("keeps a null-error group for a row that died before any error was recorded", async () => {
    await inbox.insertOne(aDeadInboxDoc({ lastError: null }));

    const { payload } = await breakdownInbox();

    expect(groupFor(payload.groups, null)).toBeDefined();
  });

  it("counts only DEAD_LETTER rows", async () => {
    await inbox.insertOne(
      aDeadInboxDoc({
        status: "COMPLETED",
        lastError: { name: "Error", message: "COMPLETED-ONLY", at: null },
        claimExpiresAt: FAR_FUTURE,
      }),
    );

    const { payload } = await breakdownInbox();

    expect(groupFor(payload.groups, "COMPLETED-ONLY")).toBeUndefined();
  });

  it("excludes a PARKED row - parked poison is not stuck work", async () => {
    const doc = aDeadInboxDoc({
      lastError: { name: "Error", message: "PARK-ME", at: null },
    });
    await inbox.insertOne(doc);
    await parkInboxEvent(doc._id.toHexString(), { reason: "poison" });

    const { payload } = await breakdownInbox();

    expect(groupFor(payload.groups, "PARK-ME")).toBeUndefined();
  });

  it("honours the same q/from/to filter the list and the counts use", async () => {
    const ref = SEG();
    await inbox.insertOne(aDeadInboxDoc({ segregationRef: ref }));
    await inbox.insertOne(aDeadInboxDoc());

    const { payload } = await breakdownInbox({ q: ref });

    expect(payload.groups).toHaveLength(1);
    expect(payload.groups[0].count).toBe(1);
  });

  it("rejects a status parameter - the scope is always DEAD_LETTER", async () => {
    await expect(breakdownInbox({ status: "FAILED" })).rejects.toThrow(/400/);
  });

  it("is a 401 without a bearer token", async () => {
    await expect(breakdownInbox(undefined, null)).rejects.toThrow(/401/);
  });
});

describe("GET /actuators/outbox/breakdown", () => {
  it("groups on the outbox's own stored event.type", async () => {
    await outbox.insertMany([aDeadOutboxDoc(), aDeadOutboxDoc()]);

    const { payload } = await breakdownOutbox();
    const group = groupFor(payload.groups, "publish failed");

    expect(group.count).toBeGreaterThanOrEqual(2);
    expect(group.type).toBe(
      "cloud.defra.prd.fg-cw-backend.case.status.updated",
    );
  });
});

describe("the error filter and the breakdown agree", () => {
  it("filters the list to exactly the rows one breakdown group counts", async () => {
    const ref = SEG();
    await inbox.insertMany([
      aDeadInboxDoc({ segregationRef: ref }),
      aDeadInboxDoc({
        segregationRef: ref,
        lastError: { name: "TypeError", message: "boom", at: null },
      }),
    ]);

    const { payload: breakdown } = await breakdownInbox({ q: ref });
    const group = groupFor(breakdown.groups, "No handler found");

    const { payload: page } = await findInbox({
      q: ref,
      error: "No handler found",
    });

    expect(page.data).toHaveLength(group.count);
    expect(
      page.data.every((row) => row.lastError.message === "No handler found"),
    ).toBe(true);
  });

  it("matches exactly, so a prefix of the message selects nothing", async () => {
    const ref = SEG();
    await inbox.insertOne(aDeadInboxDoc({ segregationRef: ref }));

    const { payload } = await findInbox({ q: ref, error: "No handler" });

    expect(payload.data).toHaveLength(0);
  });
});
