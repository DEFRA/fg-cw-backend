import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { countInbox, countOutbox, findOutbox } from "../helpers/actuators.js";

// NOTE - written against the same running stack the rest of test/actuators/
// uses, and committed unrun: the integration harness's ports are blocked in
// this environment. The two facets themselves are covered by
// src/common/event-facets.test.js, the aggregation by the repository tests,
// and the end-to-end merge by fg-gas-backend's own integration suite, which
// drives a stub of exactly this contract.

let client;
let inbox;
let outbox;

// The service's own audit topic - the second of the two shapes an audit outbox
// row can take (see src/common/event-list-filter.js). Matches the default the
// integration environment configures.
const AUDIT_ARN = "arn:aws:sns:eu-west-2:000000000000:cw__sns__audit_topic_arn";

const at = (minute) =>
  new Date(Date.UTC(2026, 5, 16, 10, minute)).toISOString();

const anInboxDoc = (minute, overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-counts-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: `COUNTS-${minute}`,
  status: "COMPLETED",
  completionAttempts: 1,
  eventTime: at(minute),
  lastError: null,
  attemptHistory: [],
  lastRedrive: null,
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: `evt-counts-${minute}`, time: at(minute), data: {} },
  ...overrides,
});

const anOutboxDoc = (minute, overrides = {}) => ({
  _id: new ObjectId(),
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_updated.fifo",
  segregationRef: `COUNTS-${minute}`,
  status: "COMPLETED",
  completionAttempts: 1,
  publicationDate: new Date(at(minute)),
  lastError: null,
  attemptHistory: [],
  lastRedrive: null,
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: {
    id: `evt-counts-${new ObjectId().toHexString()}`,
    type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
    time: at(minute),
    data: {},
  },
  ...overrides,
});

// The two shapes an audit row announces itself by, and both at once.
const auditByPayload = (minute) =>
  anOutboxDoc(minute, {
    event: {
      ...anOutboxDoc(minute).event,
      audit: { action: "VIEW_CASE" },
    },
  });

const auditByTarget = (minute) => anOutboxDoc(minute, { target: AUDIT_ARN });

const auditByBoth = (minute) =>
  anOutboxDoc(minute, {
    target: AUDIT_ARN,
    event: { ...anOutboxDoc(minute).event, audit: { action: "VIEW_CASE" } },
  });

const totalOf = (counts) =>
  Object.values(counts).reduce((sum, n) => sum + n, 0);

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  inbox = client.db().collection("inbox");
  outbox = client.db().collection("outbox");
});

afterAll(async () => {
  await client?.close(true);
});

beforeEach(async () => {
  await inbox.deleteMany({ messageId: /^msg-counts-/ });
  await outbox.deleteMany({ "event.id": /^evt-counts-/ });
  await outbox.deleteMany({ segregationRef: /^COUNTS-/ });
});

describe("GET /actuators/inbox/counts", () => {
  // NOTE - this file is port-blocked locally and is not run by the local
  // gates; it is updated in step with the unit tests it mirrors.
  //
  // One block, not two: the TYPE (domain/audit) facet is gone with the `kind`
  // filter it described.
  it("answers with the counts block alone, every status zero-filled", async () => {
    const { payload } = await countInbox();

    expect(Object.keys(payload)).toEqual(["counts"]);
    expect(Object.keys(payload.counts).sort()).toEqual([
      "COMPLETED",
      "DEAD_LETTER",
      "FAILED",
      "PROCESSING",
      "PUBLISHED",
      "RESUBMITTED",
    ]);
    expect(payload).not.toHaveProperty("byKind");
  });

  it("counts rows per status", async () => {
    await inbox.insertMany([
      anInboxDoc(1),
      anInboxDoc(2),
      anInboxDoc(3, { status: "DEAD_LETTER" }),
    ]);

    const { payload } = await countInbox();

    expect(payload.counts.COMPLETED).toBeGreaterThanOrEqual(2);
    expect(payload.counts.DEAD_LETTER).toBeGreaterThanOrEqual(1);
  });

  // `kind` is not a parameter any more, so a stale caller gets a 400 rather
  // than a silently unfiltered answer.
  it("400s on a kind, which is no longer a parameter", async () => {
    await expect(countInbox({ kind: "audit" })).rejects.toThrow();
    await expect(countInbox({ kind: "domain" })).rejects.toThrow();
  });

  it("narrows counts by q and by the time range", async () => {
    await inbox.insertMany([anInboxDoc(10), anInboxDoc(20), anInboxDoc(30)]);

    expect(totalOf((await countInbox({ q: "COUNTS-10" })).payload.counts)).toBe(
      1,
    );
    expect(
      totalOf((await countInbox({ from: at(15), to: at(25) })).payload.counts),
    ).toBe(1);
  });

  it("400s on a status, a cursor, and from after to", async () => {
    await expect(countInbox({ status: "FAILED" })).rejects.toThrow();
    await expect(countInbox({ cursor: "abc" })).rejects.toThrow();
    await expect(countInbox({ from: at(30), to: at(10) })).rejects.toThrow();
  });

  it("401s without a valid service token", async () => {
    await expect(countInbox(undefined, "Bearer nope")).rejects.toMatchObject({
      output: { statusCode: 401 },
    });
  });

  it("is not read as an event id by the detail route", async () => {
    const { payload } = await countInbox();

    expect(payload).toHaveProperty("counts");
    expect(payload).not.toHaveProperty("_id");
  });
});

describe("GET /actuators/outbox/counts", () => {
  const seedMixed = () =>
    outbox.insertMany([
      anOutboxDoc(1),
      anOutboxDoc(2),
      auditByPayload(3),
      auditByTarget(4),
      auditByBoth(5),
    ]);

  // Audit rows are counted like any other row now: all five, no split.
  it("counts every row, audit and domain alike, into one block", async () => {
    await seedMixed();

    const { payload } = await countOutbox();

    expect(totalOf(payload.counts)).toBe(5);
    expect(payload).not.toHaveProperty("byKind");
  });

  it("counts exactly the rows the list returns", async () => {
    await seedMixed();

    const { payload } = await countOutbox();
    const listed = await findOutbox({ pageSize: 50 });

    expect(totalOf(payload.counts)).toBe(listed.payload.data.length);
  });

  it("400s on a kind, which is no longer a parameter", async () => {
    await expect(countOutbox({ kind: "audit" })).rejects.toThrow();
  });

  it("honours the error filter, which the counts endpoint used to drop", async () => {
    await outbox.insertMany([
      anOutboxDoc(1, {
        status: "DEAD_LETTER",
        lastError: { name: "Error", message: "publish failed", at: null },
      }),
      anOutboxDoc(2, {
        status: "DEAD_LETTER",
        lastError: { name: "Error", message: "something else", at: null },
      }),
    ]);

    const { payload } = await countOutbox({ error: "publish failed" });

    expect(totalOf(payload.counts)).toBe(1);
    expect(payload.counts.DEAD_LETTER).toBe(1);
  });

  it("narrows the counts by the time range", async () => {
    await outbox.insertMany([
      anOutboxDoc(10),
      auditByTarget(20),
      anOutboxDoc(30),
    ]);

    const { payload } = await countOutbox({ from: at(15), to: at(25) });

    expect(totalOf(payload.counts)).toBe(1);
  });
});
