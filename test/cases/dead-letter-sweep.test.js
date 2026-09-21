import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../../src/common/config.js";
import {
  processExpiredEvents as claimSweepInbox,
  updateDeadEvents as sweepInbox,
} from "../../src/cases/repositories/inbox.repository.js";
import {
  updateExpiredEvents as claimSweepOutbox,
  updateDeadEvents as sweepOutbox,
} from "../../src/cases/repositories/outbox.repository.js";

// The sweep counts FAILURES, not attempts: `markAsComplete` never increments
// `completionAttempts`, and a row at the cap can never be claimed again. So a
// row that succeeded lands at cap-1 and no normal run puts a COMPLETED row at
// the cap. Lowering INBOX_MAX_RETRIES/OUTBOX_MAX_RETRIES does: every row that
// succeeded after that many failures is suddenly at or above the new cap.
// These rows are seeded above the cap for exactly that reason - at the cap
// alone the case is unreachable and the test would be vacuous.

const INBOX_CAP = parseInt(config.get("inbox.inboxMaxRetries"));
const OUTBOX_CAP = parseInt(config.get("outbox.outboxMaxRetries"));

// The container reads .env, not test/vitest.config.js. Seeding above both caps
// is what a lowered cap looks like, and it also keeps the containerised poller
// from claiming a row out from under the assertions.
const CONTAINER_CAP = 5;
const ABOVE_CAP = Math.max(INBOX_CAP, OUTBOX_CAP, CONTAINER_CAP) + 1;

const SWEPT_STATUSES = ["PUBLISHED", "FAILED", "RESUBMITTED", "PROCESSING"];

// Seeded with everything that would make a sweep match - an attempt count
// above the cap, and a claim that expired in the past - so that a row left
// alone cannot be left alone vacuously.
const PURGED_CLAIM_EXPIRED_AT = new Date("2026-06-16T10:10:00.000Z");
const PURGED_EXPIRE_AT = new Date("2026-09-14T10:10:00.000Z");

const purgedFields = () => ({
  status: "PURGED",
  completionAttempts: ABOVE_CAP,
  claimExpiresAt: PURGED_CLAIM_EXPIRED_AT,
  expireAt: PURGED_EXPIRE_AT,
});

const rowAfter = async (collection, id) => collection.findOne({ _id: id });

let client;
let inbox;
let outbox;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  const db = client.db();
  inbox = db.collection("inbox");
  outbox = db.collection("outbox");
});

afterAll(async () => {
  await client?.close();
});

const anInboxRow = (status, completionAttempts) => ({
  _id: new ObjectId(),
  messageId: `msg-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  // Unique, so the running poller cannot claim it mid-test.
  segregationRef: `SWEEP-${new ObjectId().toHexString()}`,
  status,
  completionAttempts,
  completionDate: status === "COMPLETED" ? "2026-06-16T10:05:00.000Z" : null,
  eventTime: "2026-06-16T10:00:00.000Z",
  attemptHistory: [],
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: {} },
});

const anOutboxRow = (status, completionAttempts) => ({
  _id: new ObjectId(),
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case_fifo.fifo",
  segregationRef: `SWEEP-${new ObjectId().toHexString()}`,
  status,
  completionAttempts,
  completionDate: status === "COMPLETED" ? "2026-06-16T10:05:00.000Z" : null,
  publicationDate: new Date("2026-06-16T10:00:00.000Z"),
  attemptHistory: [],
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: {} },
});

const statusOf = async (collection, id) =>
  (await collection.findOne({ _id: id }))?.status;

describe("inbox dead-letter sweep", () => {
  it("leaves a COMPLETED row at the cap alone", async () => {
    const row = anInboxRow("COMPLETED", INBOX_CAP);
    await inbox.insertOne(row);

    await sweepInbox();

    expect(await statusOf(inbox, row._id)).toBe("COMPLETED");
  });

  it("leaves a COMPLETED row above a lowered cap alone", async () => {
    const row = anInboxRow("COMPLETED", ABOVE_CAP);
    await inbox.insertOne(row);

    await sweepInbox();

    expect(await statusOf(inbox, row._id)).toBe("COMPLETED");
  });

  it.each(SWEPT_STATUSES)(
    "dead-letters a %s row at or above the cap",
    async (status) => {
      const row = anInboxRow(status, ABOVE_CAP);
      await inbox.insertOne(row);

      await sweepInbox();

      expect(await statusOf(inbox, row._id)).toBe("DEAD_LETTER");
    },
  );

  // Mongo counts no modification for a `$set` that changes nothing, so only
  // `matchedCount` says the filter never reached the row.
  it("does not rewrite a row that is already DEAD_LETTER", async () => {
    const row = {
      ...anInboxRow("DEAD_LETTER", ABOVE_CAP),
      claimedBy: "sweep-test",
    };
    await inbox.insertOne(row);

    const { matchedCount, modifiedCount } = await sweepInbox();

    expect(matchedCount).toBe(0);
    expect(modifiedCount).toBe(0);
    expect((await rowAfter(inbox, row._id)).claimedBy).toBe("sweep-test");
  });

  it("leaves a PURGED row at the cap alone", async () => {
    const row = { ...anInboxRow("PURGED", ABOVE_CAP), ...purgedFields() };
    await inbox.insertOne(row);

    await sweepInbox();

    expect(await statusOf(inbox, row._id)).toBe("PURGED");
  });

  it("leaves a PURGED row's deletion date alone", async () => {
    const row = { ...anInboxRow("PURGED", ABOVE_CAP), ...purgedFields() };
    await inbox.insertOne(row);

    await sweepInbox();

    expect((await rowAfter(inbox, row._id)).expireAt).toEqual(PURGED_EXPIRE_AT);
  });
});

describe("inbox claim-expiry sweep", () => {
  it("leaves a PURGED row with a long-expired claim alone", async () => {
    const row = { ...anInboxRow("PURGED", ABOVE_CAP), ...purgedFields() };
    await inbox.insertOne(row);

    await claimSweepInbox();

    expect(await statusOf(inbox, row._id)).toBe("PURGED");
  });

  it("does not count a failed attempt against a PURGED row", async () => {
    const row = { ...anInboxRow("PURGED", ABOVE_CAP), ...purgedFields() };
    await inbox.insertOne(row);

    await claimSweepInbox();

    const stored = await rowAfter(inbox, row._id);

    expect(stored.completionAttempts).toBe(ABOVE_CAP);
    expect(stored.expireAt).toEqual(PURGED_EXPIRE_AT);
  });
});

describe("outbox dead-letter sweep", () => {
  it("leaves a COMPLETED row at the cap alone", async () => {
    const row = anOutboxRow("COMPLETED", OUTBOX_CAP);
    await outbox.insertOne(row);

    await sweepOutbox();

    expect(await statusOf(outbox, row._id)).toBe("COMPLETED");
  });

  it("leaves a COMPLETED row above a lowered cap alone", async () => {
    const row = anOutboxRow("COMPLETED", ABOVE_CAP);
    await outbox.insertOne(row);

    await sweepOutbox();

    expect(await statusOf(outbox, row._id)).toBe("COMPLETED");
  });

  it.each(SWEPT_STATUSES)(
    "dead-letters a %s row at or above the cap",
    async (status) => {
      const row = anOutboxRow(status, ABOVE_CAP);
      await outbox.insertOne(row);

      await sweepOutbox();

      expect(await statusOf(outbox, row._id)).toBe("DEAD_LETTER");
    },
  );

  // See the inbox case for why `matchedCount` is the assertion that counts.
  it("does not rewrite a row that is already DEAD_LETTER", async () => {
    const row = {
      ...anOutboxRow("DEAD_LETTER", ABOVE_CAP),
      claimedBy: "sweep-test",
    };
    await outbox.insertOne(row);

    const { matchedCount, modifiedCount } = await sweepOutbox();

    expect(matchedCount).toBe(0);
    expect(modifiedCount).toBe(0);
    expect((await rowAfter(outbox, row._id)).claimedBy).toBe("sweep-test");
  });

  it("leaves a PURGED row at the cap alone", async () => {
    const row = { ...anOutboxRow("PURGED", ABOVE_CAP), ...purgedFields() };
    await outbox.insertOne(row);

    await sweepOutbox();

    expect(await statusOf(outbox, row._id)).toBe("PURGED");
  });

  it("leaves a PURGED row's deletion date alone", async () => {
    const row = { ...anOutboxRow("PURGED", ABOVE_CAP), ...purgedFields() };
    await outbox.insertOne(row);

    await sweepOutbox();

    expect((await rowAfter(outbox, row._id)).expireAt).toEqual(
      PURGED_EXPIRE_AT,
    );
  });
});

describe("outbox claim-expiry sweep", () => {
  it("leaves a PURGED row with a long-expired claim alone", async () => {
    const row = { ...anOutboxRow("PURGED", ABOVE_CAP), ...purgedFields() };
    await outbox.insertOne(row);

    await claimSweepOutbox();

    expect(await statusOf(outbox, row._id)).toBe("PURGED");
  });

  it("does not count a failed attempt against a PURGED row", async () => {
    const row = { ...anOutboxRow("PURGED", ABOVE_CAP), ...purgedFields() };
    await outbox.insertOne(row);

    await claimSweepOutbox();

    const stored = await rowAfter(outbox, row._id);

    expect(stored.completionAttempts).toBe(ABOVE_CAP);
    expect(stored.expireAt).toEqual(PURGED_EXPIRE_AT);
  });
});
