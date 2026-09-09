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

// A held claim with a far-future expiry keeps the pollers and the claim-expiry
// sweep away from the fixtures for the life of a test.
const anInboxDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: REF,
  status: "COMPLETED",
  completionAttempts: 1,
  eventTime: "2026-06-16T10:00:00.000Z",
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
      ["direction=sideways", { direction: "sideways" }],
      ["status=BOGUS", { status: "BOGUS" }],
      ["audit=maybe", { audit: "maybe" }],
      ["a shared cursor, which this endpoint does not take", { cursor: "x" }],
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
    expect(payload.sectionErrors).toEqual([]);
  });

  it("rows are the same shape the box lists answered with", async () => {
    await inbox.insertOne(anInboxDoc());
    await outbox.insertOne(anOutboxDoc());

    const { payload } = await findPage({ q: REF });

    expect(payload.inbox.events[0]).toMatchObject({
      type: "cloud.defra.prd.fg-gas-backend.case.create.new",
      source: "GAS",
      status: "COMPLETED",
      completionAttempts: 1,
      maxAttempts: expect.any(Number),
    });
    expect(payload.outbox.events[0]).toMatchObject({
      target: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
    });
  });

  it("narrows both boxes by the same filter", async () => {
    await inbox.insertOne(anInboxDoc({ status: "DEAD_LETTER" }));
    await inbox.insertOne(anInboxDoc());
    await outbox.insertOne(anOutboxDoc());

    const { payload } = await findPage({ q: REF, status: "DEAD_LETTER" });

    expect(payload.inbox.events).toHaveLength(1);
    expect(payload.outbox.events).toHaveLength(0);
    // The counts are a facet: they answer what each status WOULD find, so the
    // status filter is deliberately not applied to them.
    expect(payload.inbox.counts.COMPLETED).toBe(1);
    expect(payload.inbox.counts.DEAD_LETTER).toBe(1);
  });

  it("pages each box by its own cursor", async () => {
    await inbox.insertMany([
      anInboxDoc({ eventTime: "2026-06-16T10:00:00.000Z" }),
      anInboxDoc({ eventTime: "2026-06-16T10:01:00.000Z" }),
    ]);
    await outbox.insertMany([
      anOutboxDoc({ publicationDate: new Date("2026-06-16T10:00:00.000Z") }),
      anOutboxDoc({ publicationDate: new Date("2026-06-16T10:01:00.000Z") }),
    ]);

    const first = await findPage({ q: REF, pageSize: 1 });
    const second = await findPage({
      q: REF,
      pageSize: 1,
      inboxCursor: first.payload.inbox.pagination.endCursor,
      outboxCursor: first.payload.outbox.pagination.endCursor,
    });

    expect(second.payload.inbox.events[0]._id).not.toBe(
      first.payload.inbox.events[0]._id,
    );
    expect(second.payload.outbox.events[0]._id).not.toBe(
      first.payload.outbox.events[0]._id,
    );
  });

  it("advances one box without disturbing the other", async () => {
    await inbox.insertMany([anInboxDoc(), anInboxDoc()]);
    await outbox.insertOne(anOutboxDoc());

    const first = await findPage({ q: REF, pageSize: 1 });
    const second = await findPage({
      q: REF,
      pageSize: 1,
      inboxCursor: first.payload.inbox.pagination.endCursor,
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
    expect(payload.sectionErrors).toEqual([]);
  });
});
