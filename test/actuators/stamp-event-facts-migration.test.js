import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { up } from "../../migrations/20261009110000-stamp-event-facts.js";
import { config } from "../../src/common/config.js";

const STATUS_TOPIC =
  "arn:aws:sns:eu-west-2:111111111111:cw__sns__case_status_updated";
const TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

// A held far-future claim keeps the pollers off the fixtures.
const held = {
  claimedBy: "test-holder",
  claimExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
};

const statusEvent = (overrides) => ({
  target: STATUS_TOPIC,
  status: "COMPLETED",
  publicationDate: new Date("2026-09-01T10:00:00.000Z"),
  segregationRef: "abc-123-example-workflow",
  ...held,
  event: {
    id: "0b7c1d1e-0000-4000-8000-000000000001",
    type: "cloud.defra.prod.fg-cw-backend.case.status.updated",
    traceparent: TRACEPARENT,
    data: { caseRef: "ABC-123", workflowCode: "example-workflow" },
  },
  ...overrides,
});

const auditRow = (overrides) => ({
  target: config.get("aws.sns.auditTopicArn"),
  status: "COMPLETED",
  publicationDate: new Date("2026-09-01T10:00:01.000Z"),
  segregationRef: "abc-123",
  ...held,
  event: {
    user: "5f0c2a9e-0000-4000-8000-000000000003",
    correlationid: "trace-1",
    audit: {
      entities: [{ entity: "CASE", action: "VIEW_CASE", entityid: "ABC-123" }],
    },
  },
  ...overrides,
});

const inboxRow = (overrides) => ({
  source: "GAS",
  status: "COMPLETED",
  publicationDate: "2026-09-01T10:00:02.000Z",
  messageId: "0b7c1d1e-0000-4000-8000-000000000002",
  traceparent: TRACEPARENT,
  type: "cloud.defra.prod.fg-gas-backend.case.create",
  segregationRef: "abc-124-example-workflow",
  ...held,
  event: {
    id: "0b7c1d1e-0000-4000-8000-000000000002",
    type: "cloud.defra.prod.fg-gas-backend.case.create",
    data: {
      caseRef: "ABC-124",
      previousCaseRef: "ABC-123",
      workflowCode: "example-workflow",
    },
  },
  ...overrides,
});

let client;
let db;
let outbox;
let inbox;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  outbox = db.collection("outbox");
  inbox = db.collection("inbox");
});

afterAll(async () => {
  await client?.close(true);
});

beforeEach(async () => {
  await Promise.all([outbox.deleteMany({}), inbox.deleteMany({})]);
});

describe("20261009110000-stamp-event-facts", () => {
  it("stamps a message written in another environment by its declared name", async () => {
    await outbox.insertOne(statusEvent());

    await up(db);

    expect(await outbox.findOne()).toMatchObject({
      eventType: "CaseStatusUpdated",
      refs: [
        "ref:abc-123",
        "case:example-workflow:~41.~42.~43.-123",
        "id:0b7c1d1e-0000-4000-8000-000000000001",
        "trace:4bf92f3577b34da6a3ce929d0e0e4736",
      ],
      status: "COMPLETED",
    });
  });

  it("stamps a row sent to the audit topic as audit", async () => {
    await outbox.insertOne(auditRow());

    await up(db);

    expect(await outbox.findOne()).toMatchObject({
      eventType: "Audit",
      refs: ["trace:trace-1"],
    });
  });

  it("stamps an inbox row from its own message id and trace", async () => {
    await inbox.insertOne(inboxRow());

    await up(db);

    const row = await inbox.findOne();

    expect(row).toMatchObject({
      eventType: "CreateCase",
      refs: [
        "ref:abc-124",
        "case:example-workflow:~41.~42.~43.-124",
        "ref:abc-123",
        "case:example-workflow:~41.~42.~43.-123",
        "id:0b7c1d1e-0000-4000-8000-000000000002",
        "trace:4bf92f3577b34da6a3ce929d0e0e4736",
      ],
    });
    expect(row).not.toHaveProperty("kind");
  });

  it("stamps a type nobody declares unrecognised and never skips the row", async () => {
    await outbox.insertOne(
      statusEvent({ event: { id: "1", type: "io.example.retired" } }),
    );
    await inbox.insertOne(
      inboxRow({
        event: {
          id: "0b7c1d1e-0000-4000-8000-000000000002",
          type: "io.example.retired",
        },
        traceparent: null,
      }),
    );

    await up(db);

    expect(await outbox.findOne()).toMatchObject({
      eventType: "Unrecognised",
      refs: ["id:1"],
    });
    expect(await inbox.findOne()).toMatchObject({
      eventType: "Unrecognised",
      refs: ["id:0b7c1d1e-0000-4000-8000-000000000002"],
    });
  });

  it("stamps a type this service only receives unrecognised in the outbox", async () => {
    await outbox.insertOne(
      statusEvent({ event: { id: "1", type: inboxRow().type } }),
    );

    await up(db);

    expect((await outbox.findOne()).eventType).toBe("Unrecognised");
  });

  it("reads an edited row's envelope as it was written", async () => {
    await outbox.insertOne(
      statusEvent({
        originalPayload: statusEvent().event,
        event: { id: "edited", type: "edited", data: {} },
      }),
    );

    await up(db);

    expect(await outbox.findOne()).toMatchObject({
      eventType: "CaseStatusUpdated",
      refs: expect.arrayContaining(["ref:abc-123"]),
    });
  });

  it("stamps a recorded error with its key, and a row already stamped but for the key as well", async () => {
    const lastError = {
      name: "TypeError",
      message: 'Case with id "6acf62688ec1821be59b4d18" not found',
      at: "2026-09-01T10:00:00.000Z",
    };
    await outbox.insertMany([
      statusEvent({ status: "DEAD_LETTER", lastError }),
      statusEvent({
        status: "DEAD_LETTER",
        lastError,
        eventType: "CaseStatusUpdated",
        refs: ["ref:abc-123"],
      }),
      statusEvent(),
    ]);

    await up(db);

    expect(
      (await outbox.find().sort({ _id: 1 }).toArray()).map(
        ({ errorKey }) => errorKey,
      ),
    ).toEqual([
      "TypeError: Case with id <v> not found",
      "TypeError: Case with id <v> not found",
      undefined,
    ]);
  });

  it("gives a row with no identifier an empty refs list, not a missing one", async () => {
    await outbox.insertOne(
      statusEvent({ event: { type: "io.example.retired" } }),
    );

    await up(db);

    expect((await outbox.findOne()).refs).toEqual([]);
  });

  it("leaves a row its writer already stamped alone", async () => {
    const stamped = {
      eventType: "Unrecognised",
      refs: ["ref:kept"],
    };
    await outbox.insertOne(statusEvent(stamped));

    await up(db);

    expect(await outbox.findOne()).toMatchObject(stamped);
  });

  it("stamps more rows than one batch holds", async () => {
    await outbox.insertMany(
      Array.from({ length: 2500 }, (_, n) =>
        n % 2 ? statusEvent() : auditRow(),
      ),
    );

    await up(db);

    expect(
      await outbox.countDocuments({
        $or: [{ eventType: null }, { refs: null }],
      }),
    ).toBe(0);
    expect(
      await outbox.countDocuments({ eventType: "CaseStatusUpdated" }),
    ).toBe(1250);
    expect(await outbox.countDocuments({ eventType: "Audit" })).toBe(1250);
    expect(await outbox.countDocuments({ kind: { $exists: true } })).toBe(0);
  });

  it("is safe to run again", async () => {
    await outbox.insertMany([statusEvent(), auditRow()]);
    await inbox.insertOne(inboxRow());

    await up(db);
    const before = await outbox.find().toArray();
    await up(db);

    expect(await outbox.find().toArray()).toEqual(before);
  });

  it.each([
    ["outbox", () => statusEvent({ status: "ARCHIVED" })],
    ["inbox", () => inboxRow({ status: "ARCHIVED" })],
  ])("throws over an %s status outside the listed values", async (box, doc) => {
    await db.collection(box).insertOne(doc());

    await expect(up(db)).rejects.toThrow(
      `1 ${box} rows hold a status outside the listed values`,
    );
  });
});
