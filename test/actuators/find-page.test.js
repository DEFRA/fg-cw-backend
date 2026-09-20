import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { findPage } from "../helpers/actuators.js";
import { TestUser, getTokenFor } from "../helpers/users.js";

let client;
let inbox;
let outbox;

const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");
const REF = "PAGE-9B2-composite";

// Built as fg-gas-backend does: base64url JSON of the sort key and `_id`.
const cursorFor = (row) =>
  Buffer.from(
    JSON.stringify({ publicationDate: row.publicationDate, _id: row._id }),
  ).toString("base64url");

// A held far-future claim keeps the pollers and expiry sweep off the fixtures.
const anInboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: REF,
  status: "COMPLETED",
  completionAttempts: 1,
  eventTime: "2026-06-16T10:00:00.000Z",
  publicationDate: "2026-06-16T10:00:00.000Z",
  lastResubmissionDate: null,
  completionDate: null,
  claimedBy: "test-holder",
  claimedAt: new Date(),
  claimExpiresAt: FAR_FUTURE,
  event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z" },
  ...overrides,
});

const anOutboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  event: {
    id: `evt-${new ObjectId().toHexString()}`,
    type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
  },
  target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
  segregationRef: REF,
  status: "COMPLETED",
  completionAttempts: 1,
  publicationDate: new Date("2026-06-16T10:05:00.000Z"),
  lastResubmissionDate: null,
  completionDate: null,
  claimedBy: "test-holder",
  claimedAt: new Date(),
  claimExpiresAt: FAR_FUTURE,
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

beforeEach(async () => {
  await inbox.deleteMany({ segregationRef: REF });
  await outbox.deleteMany({ segregationRef: REF });
});

describe("GET /actuators/events", () => {
  describe("auth", () => {
    it("rejects a request with no token", async () => {
      await expect(findPage(undefined, null)).rejects.toThrow(
        "Response Error: 401 Unauthorized",
      );
    });

    it("rejects a valid Entra user token", async () => {
      const token = await getTokenFor(TestUser.Admin.email);

      await expect(findPage(undefined, `Bearer ${token}`)).rejects.toThrow(
        "Response Error: 401 Unauthorized",
      );
    });

    it("answers a caller holding the seeded service token", async () => {
      const { res } = await findPage();

      expect(res.statusCode).toBe(200);
    });
  });

  describe("validation", () => {
    it.each([
      ["pageSize=51", { pageSize: 51 }],
      ["pageSize=0", { pageSize: 0 }],
      ["status=BOGUS", { status: "BOGUS" }],
      ["audit=maybe", { audit: "maybe" }],
      ["an undeclared query key", { someUnknownKey: "x" }],
    ])("rejects %s with 400", async (_name, query) => {
      await expect(findPage(query)).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    });

    it("rejects a range that ends before it starts", async () => {
      await expect(
        findPage({
          from: "2026-06-17T00:00:00.000Z",
          to: "2026-06-16T00:00:00.000Z",
        }),
      ).rejects.toThrow("Response Error: 400 Bad Request");
    });
  });

  it("answers with both boxes, their figures and their groups", async () => {
    await inbox.insertOne(anInboxDoc());
    await outbox.insertOne(anOutboxDoc());

    const { payload } = await findPage({ q: REF });

    expect(payload.inbox.events).toHaveLength(1);
    expect(payload.outbox.events).toHaveLength(1);
    expect(payload.inbox.pagination).toMatchObject({ hasNextPage: false });
    expect(payload.inbox.counts.COMPLETED).toBe(1);
    expect(payload.outbox.counts.COMPLETED).toBe(1);
    expect(payload.inbox.breakdown.groups).toEqual([]);
  });

  it("answers each box's rows with the list fields", async () => {
    const inboxDoc = anInboxDoc();
    const outboxDoc = anOutboxDoc();
    await inbox.insertOne(inboxDoc);
    await outbox.insertOne(outboxDoc);

    const { payload } = await findPage({ q: REF });

    expect(payload.inbox.events).toEqual([
      {
        _id: inboxDoc._id.toHexString(),
        eventId: inboxDoc.messageId,
        type: "cloud.defra.prd.fg-gas-backend.case.create.new",
        status: "COMPLETED",
        publicationDate: "2026-06-16T10:00:00.000Z",
        completedAt: null,
      },
    ]);
    expect(payload.outbox.events).toEqual([
      {
        _id: outboxDoc._id.toHexString(),
        eventId: outboxDoc.event.id,
        type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
        status: "COMPLETED",
        publicationDate: "2026-06-16T10:05:00.000Z",
        completedAt: null,
      },
    ]);
  });

  it("narrows both boxes by the same filter", async () => {
    await inbox.insertOne(anInboxDoc({ status: "DEAD_LETTER" }));
    await inbox.insertOne(anInboxDoc());
    await outbox.insertOne(anOutboxDoc());

    const { payload } = await findPage({ q: REF, status: "DEAD_LETTER" });

    expect(payload.inbox.events).toHaveLength(1);
    expect(payload.outbox.events).toHaveLength(0);
    // Counts are a facet, so the status filter is not applied to them.
    expect(payload.inbox.counts.COMPLETED).toBe(1);
    expect(payload.inbox.counts.DEAD_LETTER).toBe(1);
  });

  it("pages each box by its own cursor", async () => {
    await inbox.insertMany([
      anInboxDoc({ publicationDate: "2026-06-16T10:00:00.000Z" }),
      anInboxDoc({ publicationDate: "2026-06-16T10:01:00.000Z" }),
    ]);
    await outbox.insertMany([
      anOutboxDoc({ publicationDate: new Date("2026-06-16T10:00:00.000Z") }),
      anOutboxDoc({ publicationDate: new Date("2026-06-16T10:01:00.000Z") }),
    ]);

    const first = await findPage({ q: REF, pageSize: 1 });
    const second = await findPage({
      q: REF,
      pageSize: 1,
      inboxCursor: cursorFor(first.payload.inbox.events[0]),
      outboxCursor: cursorFor(first.payload.outbox.events[0]),
    });

    expect(second.payload.inbox.events[0]._id).not.toBe(
      first.payload.inbox.events[0]._id,
    );
    expect(second.payload.outbox.events[0]._id).not.toBe(
      first.payload.outbox.events[0]._id,
    );
  });

  // `eventTime` runs the opposite way to `publicationDate` here.
  it("orders and pages the inbox by publicationDate, not eventTime", async () => {
    const older = anInboxDoc({
      eventTime: "2026-06-16T12:00:00.000Z",
      publicationDate: "2026-06-16T10:00:00.000Z",
    });
    const newer = anInboxDoc({
      eventTime: "2026-06-16T09:00:00.000Z",
      publicationDate: "2026-06-16T10:01:00.000Z",
    });
    await inbox.insertMany([older, newer]);

    const first = await findPage({ q: REF, pageSize: 1 });

    expect(first.payload.inbox.events[0]._id).toBe(newer._id.toHexString());
    expect(first.payload.inbox.events[0].publicationDate).toBe(
      "2026-06-16T10:01:00.000Z",
    );
    expect(first.payload.inbox.pagination.hasNextPage).toBe(true);

    const second = await findPage({
      q: REF,
      pageSize: 1,
      inboxCursor: cursorFor(first.payload.inbox.events[0]),
    });

    expect(second.payload.inbox.events.map((row) => row._id)).toEqual([
      older._id.toHexString(),
    ]);
    expect(second.payload.inbox.events[0].publicationDate).toBe(
      "2026-06-16T10:00:00.000Z",
    );
    expect(second.payload.inbox.pagination.hasNextPage).toBe(false);
  });

  it("time-filters the inbox on publicationDate, inclusive at both ends", async () => {
    const inside = anInboxDoc({
      eventTime: "2026-06-15T08:00:00.000Z",
      publicationDate: "2026-06-16T10:00:00.000Z",
    });
    const outside = anInboxDoc({
      eventTime: "2026-06-16T10:00:00.000Z",
      publicationDate: "2026-06-17T08:00:00.000Z",
    });
    await inbox.insertMany([inside, outside]);

    const { payload } = await findPage({
      q: REF,
      from: "2026-06-16T11:00:00.000+01:00",
      to: "2026-06-16T10:00:00.000Z",
    });

    expect(payload.inbox.events.map((row) => row._id)).toEqual([
      inside._id.toHexString(),
    ]);
    expect(payload.inbox.counts.COMPLETED).toBe(1);
  });

  // The paginator ANDs a redundant bound on the leading sort key beside the
  // keyset; paging a status-filtered box must still return exactly the rows
  // one unpaged read does, in the same order, ties on publicationDate included.
  it("pages a status-filtered box to the same rows as one unpaged read", async () => {
    const at = (minute) =>
      new Date(Date.UTC(2026, 5, 16, 10, Math.floor(minute / 2)));
    const inboxDocs = [];
    const outboxDocs = [];

    for (let i = 0; i < 15; i++) {
      const status = i % 3 === 0 ? "COMPLETED" : "DEAD_LETTER";

      inboxDocs.push(
        anInboxDoc({ status, publicationDate: at(i).toISOString() }),
      );
      outboxDocs.push(anOutboxDoc({ status, publicationDate: at(i) }));
    }

    await inbox.insertMany(inboxDocs);
    await outbox.insertMany(outboxDocs);

    const query = { q: REF, status: "DEAD_LETTER", sections: "list" };
    const { payload: whole } = await findPage({ ...query, pageSize: 50 });

    const pagedIds = async (box, cursorName) => {
      const ids = [];
      let cursor;

      for (let pages = 0; pages < 20; pages++) {
        const { payload } = await findPage({
          ...query,
          pageSize: 3,
          ...(cursor ? { [cursorName]: cursor } : {}),
        });
        const rows = payload[box].events;

        ids.push(...rows.map((row) => row._id));

        if (!payload[box].pagination.hasNextPage) {
          return ids;
        }

        cursor = cursorFor(rows.at(-1));
      }

      return ids;
    };

    expect(whole.inbox.events).toHaveLength(10);
    expect(whole.outbox.events).toHaveLength(10);
    expect(await pagedIds("inbox", "inboxCursor")).toEqual(
      whole.inbox.events.map((row) => row._id),
    );
    expect(await pagedIds("outbox", "outboxCursor")).toEqual(
      whole.outbox.events.map((row) => row._id),
    );
    expect(whole.inbox.counts).toBeNull();
    expect(whole.inbox.breakdown).toBeNull();
  });

  it("rejects an unknown section with 400", async () => {
    await expect(findPage({ sections: "list,rows" })).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
  });

  it("advances one box without disturbing the other", async () => {
    await inbox.insertMany([anInboxDoc(), anInboxDoc()]);
    await outbox.insertOne(anOutboxDoc());

    const first = await findPage({ q: REF, pageSize: 1 });
    const second = await findPage({
      q: REF,
      pageSize: 1,
      inboxCursor: cursorFor(first.payload.inbox.events[0]),
    });

    expect(second.payload.outbox.events[0]._id).toBe(
      first.payload.outbox.events[0]._id,
    );
  });

  it("groups the dead letters of each box by their failure", async () => {
    await inbox.insertOne(
      anInboxDoc({
        status: "DEAD_LETTER",
        lastError: { name: "TypeError", message: "boom", at: null },
      }),
    );

    const { payload } = await findPage({ q: REF });

    expect(payload.inbox.breakdown.groups).toEqual([
      expect.objectContaining({ error: "boom", count: 1 }),
    ]);
    expect(payload.outbox.breakdown.groups).toEqual([]);
  });

  it("answers with empty boxes rather than nothing at all", async () => {
    const { payload } = await findPage({ q: "nothing-matches-this" });

    expect(payload.inbox.events).toEqual([]);
    expect(payload.outbox.events).toEqual([]);
  });
});
