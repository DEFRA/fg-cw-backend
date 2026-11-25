import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anAttemptHistory } from "../fixtures/attempt-history.js";
import {
  editInboxPayload,
  getInboxEvent,
  getInboxEventStatus,
  getOutboxEvent,
  getOutboxEventStatus,
  purgeInboxEvent,
  redriveInboxEvent,
  redriveOutboxEvent,
  seedCaseReaderToken,
} from "../helpers/actuators.js";

let client;
let inbox;
let outbox;

const UNKNOWN_ID = "665f1c2e9a1b2c3d4e5f6aaa";
const MAX_RETRIES = 5;

const aDeadInboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  // unique, so the poller cannot claim it mid-test
  segregationRef: `HISTORY-${new ObjectId().toHexString()}`,
  status: "DEAD_LETTER",
  completionAttempts: MAX_RETRIES,
  publicationDate: "2026-06-16T10:00:00.000Z",
  eventTime: "2026-06-16T10:00:00.000Z",
  lastResubmissionDate: "2026-06-16T10:05:00.000Z",
  attemptHistory: anAttemptHistory({ length: MAX_RETRIES, message: "boom" }),
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: { n: 0 } },
  ...overrides,
});

const auditEventsFor = (id) =>
  outbox.countDocuments({
    "event.audit.entities.entityid": id,
  });

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  inbox = client.db().collection("inbox");
  outbox = client.db().collection("outbox");
  await seedCaseReaderToken(client.db());
});

afterAll(async () => {
  await client?.close(true);
});

describe("GET /actuators/events/{box}/{id}/status", () => {
  it("rejects a request with no token", async () => {
    await expect(getInboxEventStatus(UNKNOWN_ID, null)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("rejects an id that is not a 24-hex ObjectId with 400", async () => {
    await expect(getInboxEventStatus("nope")).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
  });

  it("404s for an id that does not exist on either box", async () => {
    await expect(getInboxEventStatus(UNKNOWN_ID)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
    await expect(getOutboxEventStatus(UNKNOWN_ID)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });

  it("returns the status and the attempts against the cap, and nothing else", async () => {
    const doc = aDeadInboxDoc({ status: "COMPLETED", completionAttempts: 2 });
    await inbox.insertOne(doc);

    const { payload } = await getInboxEventStatus(doc._id.toHexString());

    expect(payload).toEqual({
      status: "COMPLETED",
      completionAttempts: 2,
      maxAttempts: MAX_RETRIES,
    });
  });

  it("answers for the outbox too", async () => {
    const doc = {
      _id: new ObjectId(),
      target: "arn:aws:sns:eu-west-2:000000000000:x.fifo",
      segregationRef: `HISTORY-${new ObjectId().toHexString()}`,
      status: "PURGED",
      completionAttempts: MAX_RETRIES,
      event: { id: "evt-2", data: {} },
    };
    await outbox.insertOne(doc);

    const { payload } = await getOutboxEventStatus(doc._id.toHexString());

    expect(payload).toEqual({
      status: "PURGED",
      completionAttempts: MAX_RETRIES,
      maxAttempts: MAX_RETRIES,
    });
  });

  it("writes no audit event", async () => {
    const doc = aDeadInboxDoc();
    await inbox.insertOne(doc);
    const id = doc._id.toHexString();

    await getInboxEventStatus(id);
    await getInboxEventStatus(id);

    expect(await auditEventsFor(id)).toBe(0);
  });
});

describe("the detail's history", () => {
  it("is empty on a row written before it existed", async () => {
    const doc = aDeadInboxDoc({
      lastRedrive: { at: "2026-06-16T11:00:00.000Z", by: "ada" },
    });
    await inbox.insertOne(doc);

    const { payload } = await getInboxEvent(doc._id.toHexString());

    expect(payload.history).toEqual([]);
    expect(payload.lastRedrive).toEqual({
      at: "2026-06-16T11:00:00.000Z",
      by: "ada",
    });
  });

  it("is served on the outbox detail too", async () => {
    const doc = {
      _id: new ObjectId(),
      target: "arn:aws:sns:eu-west-2:000000000000:x.fifo",
      segregationRef: `HISTORY-${new ObjectId().toHexString()}`,
      status: "PURGED",
      completionAttempts: MAX_RETRIES,
      history: [{ kind: "dead-lettered", at: "2026-06-16T10:05:00.000Z" }],
      event: { id: "evt-2", data: {} },
    };
    await outbox.insertOne(doc);

    const { payload } = await getOutboxEvent(doc._id.toHexString());

    expect(payload.history).toEqual([
      { kind: "dead-lettered", at: "2026-06-16T10:05:00.000Z" },
    ]);
  });

  it("records an edit, a purge and a redrive in order, and keeps the attempts", async () => {
    const doc = aDeadInboxDoc();
    await inbox.insertOne(doc);
    const id = doc._id.toHexString();
    const edited = { ...doc.event, data: { n: 1 } };

    await editInboxPayload(id, {
      by: "ada",
      payload: edited,
      note: "fixed n",
      revision: 0,
    });
    await purgeInboxEvent(id, { by: "ada", reasonCode: "OTHER", note: "x" });
    await redriveInboxEvent(id, { by: "bo" });

    const { payload } = await getInboxEvent(id);

    expect(payload.history).toEqual([
      { kind: "dead-lettered", at: doc.lastResubmissionDate },
      {
        kind: "payload-edited",
        at: payload.lastEdit.at,
        by: "ada",
        note: "fixed n",
        before: doc.event,
      },
      { kind: "purged", ...payload.lastPurge },
      { kind: "redriven", at: payload.lastRedrive.at, by: "bo" },
    ]);
    expect(payload.attemptHistory.slice(0, MAX_RETRIES)).toEqual(
      doc.attemptHistory,
    );
  });
});

describe("a row from before the history", () => {
  const LEGACY_EDIT = {
    at: "2026-06-16T10:06:00.000Z",
    by: "bob",
    note: "fixed n",
  };
  const LEGACY_REDRIVE = { at: "2026-06-16T10:07:00.000Z", by: "ada" };
  const ORIGINAL = { id: "evt-1", data: { n: "0" } };

  const derived = {
    edit: (before) => ({
      kind: "payload-edited",
      ...LEGACY_EDIT,
      ...(before && { before }),
    }),
    redrive: { kind: "redriven", ...LEGACY_REDRIVE },
    death: (doc) => ({ kind: "dead-lettered", at: doc.lastResubmissionDate }),
  };

  const aLegacyDoc = (overrides = {}) =>
    aDeadInboxDoc({
      payloadRevision: 2,
      originalPayload: ORIGINAL,
      lastEdit: LEGACY_EDIT,
      lastRedrive: LEGACY_REDRIVE,
      lastResubmissionDate: "2026-06-16T10:08:00.000Z",
      ...overrides,
    });

  it("keeps its last edit, redrive and death when it is redriven", async () => {
    const doc = aLegacyDoc();
    await inbox.insertOne(doc);
    const id = doc._id.toHexString();

    await redriveInboxEvent(id, { by: "cy" });

    const { payload } = await getInboxEvent(id);

    expect(payload.history).toEqual([
      derived.edit(),
      derived.redrive,
      derived.death(doc),
      { kind: "redriven", at: payload.lastRedrive.at, by: "cy" },
    ]);
  });

  it("keeps them when it is purged", async () => {
    const doc = aLegacyDoc();
    await inbox.insertOne(doc);
    const id = doc._id.toHexString();

    await purgeInboxEvent(id, { by: "cy", reasonCode: "SENT_IN_ERROR" });

    const { payload } = await getInboxEvent(id);

    expect(payload.history).toEqual([
      derived.edit(),
      derived.redrive,
      derived.death(doc),
      { kind: "purged", ...payload.lastPurge },
    ]);
  });

  it("keeps its last purge when it is redriven", async () => {
    const lastPurge = {
      at: "2026-06-16T10:09:00.000Z",
      by: "dee",
      reasonCode: "OTHER",
      note: "dup",
    };
    const doc = aLegacyDoc({ status: "PURGED", lastPurge });
    await inbox.insertOne(doc);
    const id = doc._id.toHexString();

    await redriveInboxEvent(id, { by: "cy" });

    const { payload } = await getInboxEvent(id);

    expect(payload.history).toContainEqual({ kind: "purged", ...lastPurge });
  });

  it("keeps a lone edit's original as its before-image when it is edited again", async () => {
    const doc = aLegacyDoc({ payloadRevision: 1, lastRedrive: null });
    await inbox.insertOne(doc);
    const id = doc._id.toHexString();

    await editInboxPayload(id, {
      by: "cy",
      payload: { ...doc.event, data: { n: 2 } },
      note: "again",
      revision: 1,
    });

    const { payload } = await getInboxEvent(id);

    expect(payload.history).toEqual([
      derived.edit(ORIGINAL),
      derived.death(doc),
      {
        kind: "payload-edited",
        at: payload.lastEdit.at,
        by: "cy",
        note: "again",
        before: doc.event,
      },
    ]);
  });

  it("derives each entry once, however many actions follow", async () => {
    const doc = aLegacyDoc();
    await inbox.insertOne(doc);
    const id = doc._id.toHexString();

    await purgeInboxEvent(id, { by: "cy", reasonCode: "SENT_IN_ERROR" });
    await redriveInboxEvent(id, { by: "cy" });

    const { payload } = await getInboxEvent(id);

    expect(payload.history.map(({ kind }) => kind)).toEqual([
      "payload-edited",
      "redriven",
      "dead-lettered",
      "purged",
      "redriven",
    ]);
  });

  it("keeps a death since its last redrive when only an older one is stored", async () => {
    const earlier = { kind: "dead-lettered", at: "2026-06-16T10:05:00.000Z" };
    const doc = aLegacyDoc({
      lastEdit: null,
      history: [earlier, derived.redrive],
    });
    await inbox.insertOne(doc);
    const id = doc._id.toHexString();

    await redriveInboxEvent(id, { by: "cy" });

    const { payload } = await getInboxEvent(id);

    expect(payload.history).toEqual([
      earlier,
      derived.redrive,
      derived.death(doc),
      { kind: "redriven", at: payload.lastRedrive.at, by: "cy" },
    ]);
  });

  it("merges a redrive only lastRedrive holds before a death stored since", async () => {
    const death = { kind: "dead-lettered", at: "2026-06-16T10:08:00.000Z" };
    const doc = aLegacyDoc({ lastEdit: null, history: [death] });
    await inbox.insertOne(doc);
    const id = doc._id.toHexString();

    await purgeInboxEvent(id, { by: "cy", reasonCode: "SENT_IN_ERROR" });

    const { payload } = await getInboxEvent(id);

    expect(payload.history).toEqual([
      derived.redrive,
      death,
      { kind: "purged", ...payload.lastPurge },
    ]);
  });

  it("keeps them on the outbox too", async () => {
    const doc = {
      _id: new ObjectId(),
      target: "arn:aws:sns:eu-west-2:000000000000:x.fifo",
      segregationRef: `HISTORY-${new ObjectId().toHexString()}`,
      status: "DEAD_LETTER",
      completionAttempts: MAX_RETRIES,
      lastRedrive: LEGACY_REDRIVE,
      lastResubmissionDate: "2026-06-16T10:08:00.000Z",
      event: { id: "evt-2", data: {} },
    };
    await outbox.insertOne(doc);
    const id = doc._id.toHexString();

    await redriveOutboxEvent(id, { by: "cy" });

    const { payload } = await getOutboxEvent(id);

    expect(payload.history).toEqual([
      derived.redrive,
      derived.death(doc),
      { kind: "redriven", at: payload.lastRedrive.at, by: "cy" },
    ]);
  });
});
