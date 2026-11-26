import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { anAttemptHistory } from "../fixtures/attempt-history.js";

// Its own database, so the running service's poller cannot claim the fixtures.
const DATABASE = "fg-cw-backend-event-history-test";
vi.stubEnv("MONGO_DATABASE", DATABASE);

const inboxRepository =
  await import("../../src/cases/repositories/inbox.repository.js");
const outboxRepository =
  await import("../../src/cases/repositories/outbox.repository.js");
const { mongoClient } = await import("../../src/common/mongo-client.js");

const MAX_RETRIES = 5;
const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let client;
let inbox;
let outbox;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  inbox = client.db(DATABASE).collection("inbox");
  outbox = client.db(DATABASE).collection("outbox");
  await mongoClient.connect();
});

beforeEach(async () => {
  await inbox.deleteMany({});
  await outbox.deleteMany({});
});

afterAll(async () => {
  await client?.db(DATABASE).dropDatabase();
  await client?.close();
  await mongoClient.close();
  vi.unstubAllEnvs();
});

const anInboxRow = (overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: `HISTORY-${new ObjectId().toHexString()}`,
  status: "DEAD_LETTER",
  completionAttempts: MAX_RETRIES,
  publicationDate: "2026-06-16T10:00:00.000Z",
  eventTime: "2026-06-16T10:00:00.000Z",
  lastResubmissionDate: "2026-06-16T10:04:00.000Z",
  attemptHistory: anAttemptHistory({
    length: MAX_RETRIES,
    message: "before the redrive",
  }),
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: { n: 0 } },
  ...overrides,
});

const anOutboxRow = (overrides = {}) => ({
  _id: new ObjectId(),
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__create_case_fifo.fifo",
  segregationRef: `HISTORY-${new ObjectId().toHexString()}`,
  status: "DEAD_LETTER",
  completionAttempts: MAX_RETRIES,
  publicationDate: new Date("2026-06-16T10:00:00.000Z"),
  attemptHistory: [],
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-2", type: "cloud.defra.prd.fg-cw-backend.x", data: {} },
  ...overrides,
});

const insert = async (collection, row) => {
  await collection.insertOne(row);

  return row._id.toHexString();
};

const stored = (collection, id) =>
  collection.findOne({ _id: ObjectId.createFromHexString(id) });

const kindsOf = (row) => (row.history ?? []).map(({ kind }) => kind);

// Claimed and failed the way the poller does it: the model, then `update()`.
const failClaimed = async (segregationRef, error) => {
  const [claimed] = await inboxRepository.claimEvents(
    "worker",
    segregationRef,
    1,
  );

  claimed.markAsFailed(error);
  await inboxRepository.update(claimed, "worker");

  return claimed;
};

const permanent = (message) =>
  Object.assign(new Error(message), { retryable: false });

describe("a redrive", () => {
  it("keeps the attempts before it, so the ones since are those after lastRedrive.at", async () => {
    const row = anInboxRow();
    const id = await insert(inbox, row);

    await inboxRepository.redriveById(id, { by: "ada" });
    await inbox.updateOne({ _id: row._id }, { $set: { status: "PUBLISHED" } });
    await failClaimed(row.segregationRef, new Error("after the redrive"));

    const after = await stored(inbox, id);
    const since = after.attemptHistory.filter(
      ({ at }) => at > after.lastRedrive.at,
    );

    expect(after.completionAttempts).toBe(1);
    expect(after.attemptHistory).toHaveLength(MAX_RETRIES + 1);
    expect(since.map(({ message }) => message)).toEqual(["after the redrive"]);
    expect(after.history).toEqual([
      { kind: "dead-lettered", at: row.lastResubmissionDate },
      { kind: "redriven", at: after.lastRedrive.at, by: "ada" },
    ]);
  });

  it("starts the history of a row written before it existed", async () => {
    const id = await insert(outbox, anOutboxRow());

    await outboxRepository.redriveById(id, { by: null });

    const after = await stored(outbox, id);

    expect(after.history).toEqual([
      { kind: "redriven", at: expect.stringMatching(ISO_MS), by: null },
    ]);
  });
});

describe("the attempt cap", () => {
  it("keeps the 25 newest attempts when a sweep pushes past it", async () => {
    const id = await insert(
      inbox,
      anInboxRow({
        status: "PROCESSING",
        completionAttempts: 0,
        attemptHistory: anAttemptHistory({ length: 24, message: "old" }),
        claimExpiresAt: new Date(Date.now() - 1000),
      }),
    );

    await inboxRepository.processExpiredEvents();
    await inbox.updateOne(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { claimExpiresAt: new Date(Date.now() - 1000) } },
    );
    await inboxRepository.processExpiredEvents();

    const after = await stored(inbox, id);

    expect(after.attemptHistory).toHaveLength(25);
    expect(after.attemptHistory.at(0).at).toBe(
      anAttemptHistory({ length: 24, message: "old" })[1].at,
    );
    expect(after.attemptHistory.at(-1).name).toBe("ClaimExpired");
  });
});

describe("dead-lettering", () => {
  it("appends an entry at the failure's time when the model dead-letters", async () => {
    const row = anInboxRow({
      status: "PUBLISHED",
      completionAttempts: 0,
      history: [{ kind: "redriven", at: "2026-06-16T11:00:00.000Z", by: "x" }],
    });
    const id = await insert(inbox, row);

    const failed = await failClaimed(row.segregationRef, permanent("bad"));

    const after = await stored(inbox, id);

    expect(after.status).toBe("DEAD_LETTER");
    expect(after.history).toEqual([
      { kind: "redriven", at: "2026-06-16T11:00:00.000Z", by: "x" },
      { kind: "dead-lettered", at: failed.lastResubmissionDate },
    ]);
  });

  it.each([
    ["inbox", () => inbox, anInboxRow, inboxRepository],
    ["outbox", () => outbox, anOutboxRow, outboxRepository],
  ])(
    "appends one entry, in ms ISO, when the %s sweep dead-letters a row",
    async (_box, collection, aRow, repository) => {
      const id = await insert(collection(), aRow({ status: "FAILED" }));

      await repository.updateDeadEvents();

      const after = await stored(collection(), id);

      expect(after.status).toBe("DEAD_LETTER");
      expect(after.history).toEqual([
        { kind: "dead-lettered", at: expect.stringMatching(ISO_MS) },
      ]);
    },
  );
});

describe("a completion", () => {
  it("leaves the stored history alone", async () => {
    const history = [
      { kind: "dead-lettered", at: "2026-06-16T10:05:00.000Z" },
      { kind: "redriven", at: "2026-06-16T11:00:00.000Z", by: "ada" },
    ];
    const row = anInboxRow({
      status: "PUBLISHED",
      completionAttempts: 0,
      history,
    });
    const id = await insert(inbox, row);

    const [claimed] = await inboxRepository.claimEvents(
      "worker",
      row.segregationRef,
      1,
    );
    claimed.markAsComplete();
    await inboxRepository.update(claimed, "worker");

    const after = await stored(inbox, id);

    expect(after.status).toBe("COMPLETED");
    expect(after.history).toEqual(history);
  });
});

describe("a purge", () => {
  it("appends the same record as lastPurge", async () => {
    const id = await insert(outbox, anOutboxRow());

    await outboxRepository.purgeById(id, {
      by: "ada",
      reasonCode: "OTHER",
      note: "$status",
    });

    const after = await stored(outbox, id);

    expect(after.history).toEqual([{ kind: "purged", ...after.lastPurge }]);
    expect(after.lastPurge.note).toBe("$status");
  });
});

describe("payload edits", () => {
  const edit = (id, revision, n, before) =>
    inboxRepository.editPayloadById(id, {
      event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: { n } },
      by: "ada",
      note: `edit ${n}`,
      revision,
      before,
    });

  it("keeps the replaced payload on the five newest edits only", async () => {
    const id = await insert(inbox, anInboxRow());

    for (let n = 1; n <= 7; n++) {
      const { event } = await stored(inbox, id);

      expect(await edit(id, n - 1, n, event)).toBe(true);
    }

    const after = await stored(inbox, id);
    const [death, ...edits] = after.history;

    expect(death.kind).toBe("dead-lettered");
    expect(edits.map(({ note }) => note)).toEqual(
      Array.from({ length: 7 }, (_, i) => `edit ${i + 1}`),
    );
    expect(edits.map((entry) => entry.before?.data.n ?? null)).toEqual([
      null,
      null,
      2,
      3,
      4,
      5,
      6,
    ]);
    expect(edits[0]).toEqual({
      kind: "payload-edited",
      at: expect.stringMatching(ISO_MS),
      by: "ada",
      note: "edit 1",
    });
    expect(after.event.data.n).toBe(7);
  });

  it("counts only edits toward the five, leaving other entries whole", async () => {
    const id = await insert(inbox, anInboxRow());
    const editTo = async (n) => {
      const { event, payloadRevision } = await stored(inbox, id);

      expect(await edit(id, payloadRevision ?? 0, n, event)).toBe(true);
    };

    await editTo(1);
    await editTo(2);
    await inboxRepository.purgeById(id, { by: "ada", reasonCode: "OTHER" });
    for (let n = 3; n <= 6; n++) {
      await editTo(n);
    }

    const after = await stored(inbox, id);

    expect(after.history.map(({ kind }) => kind)).toEqual([
      "dead-lettered",
      "payload-edited",
      "payload-edited",
      "purged",
      "payload-edited",
      "payload-edited",
      "payload-edited",
      "payload-edited",
    ]);
    expect(after.history[3]).toEqual({ kind: "purged", ...after.lastPurge });
    expect(
      after.history
        .filter((entry) => "before" in entry)
        .map(({ note }) => note),
    ).toEqual(["edit 2", "edit 3", "edit 4", "edit 5", "edit 6"]);
  });

  it("stores a payload and a note holding `$` strings as written", async () => {
    const id = await insert(inbox, anInboxRow());
    const event = {
      id: "evt-1",
      type: "$type",
      time: "2026-06-16T10:00:00.000Z",
      data: { ref: "$event", nested: { path: "$$ROOT" } },
    };

    await inboxRepository.editPayloadById(id, {
      event,
      by: "ada",
      note: "$status",
      revision: 0,
      original: anInboxRow().event,
      before: anInboxRow().event,
    });

    const after = await stored(inbox, id);

    expect(after.event).toEqual(event);
    expect(after.type).toBe("$type");
    expect(after.lastEdit.note).toBe("$status");
    expect(after.history.at(-1).note).toBe("$status");
    expect(after.originalPayload).toEqual(anInboxRow().event);
  });

  it("replaces the payload rather than merging into it", async () => {
    const id = await insert(
      inbox,
      anInboxRow({ event: { id: "evt-1", time: "t", data: { gone: true } } }),
    );

    await edit(id, 0, 1, { id: "evt-1" });

    expect((await stored(inbox, id)).event.data).toEqual({ n: 1 });
  });
});

describe("rows written before the history existed", () => {
  it("serve an empty history beside the fields the admin derives entries from", async () => {
    const lastRedrive = { at: "2026-06-16T11:00:00.000Z", by: "ada" };
    const lastPurge = {
      at: "2026-06-16T12:00:00.000Z",
      by: "ada",
      reasonCode: "OTHER",
      note: null,
    };
    const lastEdit = { at: "2026-06-16T13:00:00.000Z", by: "ada", note: "n" };
    const originalPayload = { id: "evt-0" };
    const id = await insert(
      inbox,
      anInboxRow({
        status: "PURGED",
        lastRedrive,
        lastPurge,
        lastEdit,
        originalPayload,
      }),
    );

    expect(await inboxRepository.findDetailById(id)).toMatchObject({
      history: [],
      lastRedrive,
      lastPurge,
      lastEdit,
      originalPayload,
      lastResubmissionDate: "2026-06-16T10:04:00.000Z",
      attemptHistory: anAttemptHistory({
        length: MAX_RETRIES,
        message: "before the redrive",
      }),
    });
  });
});

describe("concurrent writes", () => {
  const edit = (id) =>
    inboxRepository.editPayloadById(id, {
      event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z", data: { n: 1 } },
      by: "ada",
      note: "race",
      revision: 0,
      before: { id: "evt-1" },
    });

  // An edit, a purge and a redrive of one row can each win or lose their
  // fence; whatever wins, every write that landed leaves its entry.
  it("lose no entry when operators race on one row", async () => {
    const ids = await Promise.all(
      Array.from({ length: 20 }, () => insert(inbox, anInboxRow())),
    );

    await Promise.all(
      ids.map(async (id) => {
        const writes = await Promise.all([
          edit(id).then((ok) => ok && "payload-edited"),
          inboxRepository
            .purgeById(id, { by: "ada", reasonCode: "OTHER" })
            .then((ok) => ok && "purged"),
          inboxRepository
            .redriveById(id, { by: "ada" })
            .then((ok) => ok && "redriven"),
        ]);

        const landed = writes.filter(Boolean);

        expect(landed.length).toBeGreaterThan(0);
        expect(kindsOf(await stored(inbox, id)).sort()).toEqual(
          ["dead-lettered", ...landed].sort(),
        );
      }),
    );
  });

  it("dead-letter a row once when two sweeps run together", async () => {
    const id = await insert(inbox, anInboxRow({ status: "FAILED" }));

    await Promise.all(
      Array.from({ length: 5 }, () => inboxRepository.updateDeadEvents()),
    );

    expect(kindsOf(await stored(inbox, id))).toEqual(["dead-lettered"]);
  });

  it("keep an entry written while a handler held a stale copy of the row", async () => {
    const row = anInboxRow({ status: "PUBLISHED", completionAttempts: 0 });
    const id = await insert(inbox, row);
    const [claimed] = await inboxRepository.claimEvents(
      "worker",
      row.segregationRef,
      1,
    );

    await inbox.updateOne(
      { _id: row._id },
      {
        $push: {
          history: { kind: "redriven", at: new Date().toISOString(), by: "x" },
        },
      },
    );
    claimed.markAsFailed(permanent("bad"));
    await inboxRepository.update(claimed, "worker");

    expect(kindsOf(await stored(inbox, id))).toEqual([
      "redriven",
      "dead-lettered",
    ]);
  });
});
