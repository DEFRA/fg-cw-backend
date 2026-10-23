import { MongoClient } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { up } from "../../migrations/20261028100000-restamp-events.js";
import { config } from "../../src/common/config.js";
import { logger } from "../../src/common/logger.js";

const STATUS_TOPIC =
  "arn:aws:sns:eu-west-2:111111111111:cw__sns__case_status_updated";
const TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
const TRACE = "trace:4bf92f3577b34da6a3ce929d0e0e4736";

// A held far-future claim keeps the pollers off the fixtures.
const held = {
  claimedBy: "test-holder",
  claimExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
};

const lastError = {
  name: "TypeError",
  message: 'Case with id "6acf62688ec1821be59b4d18" not found',
  at: "2026-09-01T10:00:00.000Z",
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
    data: { caseRef: "abc-123", workflowCode: "example-workflow" },
  },
  ...overrides,
});

const auditRow = (overrides) => ({
  target: config.get("aws.sns.auditTopicArn"),
  status: "COMPLETED",
  publicationDate: new Date("2026-09-01T10:00:01.000Z"),
  segregationRef: "abc-123",
  ...held,
  event: { correlationid: "trace-1" },
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
      caseRef: "abc-124",
      previousCaseRef: "abc-123",
      workflowCode: "example-workflow",
    },
  },
  ...overrides,
});

const configRow = () =>
  inboxRow({
    source: "ConfigBroker",
    messageId: "0b7c1d1e-0000-4000-8000-000000000003",
    type: "config-version.updated",
    segregationRef: "example-workflow",
    event: {
      id: "0b7c1d1e-0000-4000-8000-000000000003",
      type: "config-version.updated",
      data: { grantCode: "example-workflow", version: "1.2.0" },
    },
  });

const supplementaryRow = (overrides) =>
  inboxRow({
    messageId: "0b7c1d1e-0000-4000-8000-000000000004",
    type: "cloud.defra.prod.fg-gas-backend.case.update.supplementary.data",
    event: {
      id: "0b7c1d1e-0000-4000-8000-000000000004",
      type: "cloud.defra.prod.fg-gas-backend.case.update.supplementary.data",
      data: { caseRef: "abc-124", workflowCode: "example-workflow" },
    },
    ...overrides,
  });

// As the FGP-1500 writers stamped them before case links.
const STATUS_REFS = [
  "ref:abc-123",
  "id:0b7c1d1e-0000-4000-8000-000000000001",
  TRACE,
];

const CREATE_REFS = [
  "ref:abc-124",
  "ref:abc-123",
  "id:0b7c1d1e-0000-4000-8000-000000000002",
  TRACE,
];

const stampedStatusEvent = () =>
  statusEvent({ eventType: "CaseStatusUpdated", refs: STATUS_REFS });

const stampedInboxRow = () =>
  inboxRow({ eventType: "CreateCase", refs: CREATE_REFS });

const everyRow = async (collection) =>
  collection.find().sort({ _id: 1 }).toArray();

// Writes to the named collection are dropped, as if a row came in behind the stamp.
const droppingWritesTo = (name) => ({
  collection: (wanted) => {
    const collection = db.collection(wanted);

    return wanted === name
      ? new Proxy(collection, {
          get: (target, key) =>
            key === "bulkWrite"
              ? async () => ({})
              : Reflect.get(target, key, target),
        })
      : collection;
  },
});

// A live writer gets to the named collection between the stamp's read and its write.
const withWriterBetween = (name, write) => ({
  collection: (wanted) => {
    const collection = db.collection(wanted);

    return wanted === name
      ? new Proxy(collection, {
          get: (target, key) =>
            key === "bulkWrite"
              ? async (...args) => {
                  await write(target);

                  return target.bulkWrite(...args);
                }
              : Reflect.get(target, key, target),
        })
      : collection;
  },
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("20261028100000-restamp-events", () => {
  it("stamps rows written without stamps, whatever their _id", async () => {
    await outbox.insertMany([
      statusEvent({ status: "DEAD_LETTER", lastError }),
      auditRow(),
    ]);
    await inbox.insertOne(inboxRow());

    await up(db);

    const [status, audit] = await everyRow(outbox);

    expect(status).toMatchObject({
      eventType: "CaseStatusUpdated",
      refs: [
        "ref:abc-123",
        "case:example-workflow:abc-123",
        "id:0b7c1d1e-0000-4000-8000-000000000001",
        TRACE,
      ],
      errorKey: "TypeError: Case with id <v> not found",
    });
    expect(audit).toMatchObject({
      eventType: "Audit",
      refs: ["trace:trace-1"],
    });
    expect(await inbox.findOne()).toMatchObject({
      eventType: "CreateCase",
      refs: [
        "ref:abc-124",
        "case:example-workflow:abc-124",
        "ref:abc-123",
        "case:example-workflow:abc-123",
        "id:0b7c1d1e-0000-4000-8000-000000000002",
        TRACE,
      ],
    });
  });

  it("gives config version and supplementary data events the links they are stamped with now", async () => {
    await inbox.insertMany([
      configRow(),
      supplementaryRow(),
      supplementaryRow({
        eventType: "UpdateCaseSupplementaryData",
        refs: ["ref:abc-124", "id:0b7c1d1e-0000-4000-8000-000000000004", TRACE],
      }),
    ]);

    await up(db);

    const [configVersion, unstamped, stamped] = await everyRow(inbox);

    expect(configVersion).toMatchObject({
      eventType: "ConfigVersionUpdated",
      refs: [
        "ref:example-workflow",
        "config:example-workflow@1~2e.2~2e.0",
        "id:0b7c1d1e-0000-4000-8000-000000000003",
        TRACE,
      ],
    });
    expect(unstamped).toMatchObject({
      eventType: "UpdateCaseSupplementaryData",
      refs: [
        "ref:abc-124",
        "case:example-workflow:abc-124",
        "id:0b7c1d1e-0000-4000-8000-000000000004",
        TRACE,
      ],
    });
    expect(stamped.refs).toEqual([
      "ref:abc-124",
      "id:0b7c1d1e-0000-4000-8000-000000000004",
      TRACE,
      "case:example-workflow:abc-124",
    ]);
  });

  it("adds the case links to rows stamped before them, and changes nothing else", async () => {
    await outbox.insertOne(stampedStatusEvent());
    await inbox.insertOne(stampedInboxRow());

    await up(db);

    expect(await outbox.findOne()).toMatchObject({
      eventType: "CaseStatusUpdated",
      refs: [...STATUS_REFS, "case:example-workflow:abc-123"],
    });
    expect(await inbox.findOne()).toMatchObject({
      eventType: "CreateCase",
      refs: [
        ...CREATE_REFS,
        "case:example-workflow:abc-124",
        "case:example-workflow:abc-123",
      ],
    });
  });

  it("gives a row whose refs are null its refs, and a recorded error without a key its key", async () => {
    await outbox.insertMany([
      statusEvent({ eventType: "CaseStatusUpdated", refs: null }),
      auditRow({
        eventType: "Audit",
        refs: ["trace:trace-1"],
        status: "DEAD_LETTER",
        lastError,
      }),
    ]);

    await up(db);

    const [status, audit] = await everyRow(outbox);

    expect(status.refs).toContain("case:example-workflow:abc-123");
    expect(audit).toMatchObject({
      refs: ["trace:trace-1"],
      errorKey: "TypeError: Case with id <v> not found",
    });
  });

  it("leaves a stamp already there alone", async () => {
    const stamped = statusEvent({ eventType: "Unrecognised", refs: ["id:1"] });
    const linked = statusEvent({
      eventType: "CaseStatusUpdated",
      refs: ["case:example-workflow:abc-123"],
      lastError,
      errorKey: "kept",
    });
    await outbox.insertMany([stamped, linked]);

    await up(db);

    const [first, second] = await everyRow(outbox);

    expect(first).toEqual(stamped);
    expect(second).toEqual(linked);
  });

  it("never overwrites what a live writer stamps between its read and its write", async () => {
    const later = { name: "Error", message: "Timed out", at: "later" };
    await outbox.insertOne(statusEvent({ status: "DEAD_LETTER", lastError }));

    await up(
      withWriterBetween("outbox", (collection) =>
        collection.updateOne(
          {},
          {
            $set: {
              eventType: "Unrecognised",
              lastError: later,
              errorKey: "Error: Timed out",
            },
          },
        ),
      ),
    );

    expect(await outbox.findOne()).toMatchObject({
      eventType: "Unrecognised",
      lastError: later,
      errorKey: "Error: Timed out",
      refs: expect.arrayContaining(["case:example-workflow:abc-123"]),
    });
  });

  it("changes nothing when run again", async () => {
    await outbox.insertMany([
      statusEvent({ status: "DEAD_LETTER", lastError }),
      stampedStatusEvent(),
      auditRow(),
      statusEvent({ event: { id: "1", type: "io.example.retired" } }),
    ]);
    await inbox.insertMany([
      inboxRow(),
      stampedInboxRow(),
      inboxRow({ event: { id: "2", type: inboxRow().type, data: {} } }),
    ]);

    await up(db);
    const outboxOnce = await everyRow(outbox);
    const inboxOnce = await everyRow(inbox);
    await up(db);

    expect(await everyRow(outbox)).toEqual(outboxOnce);
    expect(await everyRow(inbox)).toEqual(inboxOnce);
  });

  it("stamps more rows than one batch holds", async () => {
    await outbox.insertMany(
      Array.from({ length: 2500 }, (_, n) =>
        n % 2 ? statusEvent() : stampedStatusEvent(),
      ),
    );

    await up(db);

    expect(
      await outbox.countDocuments({ refs: "case:example-workflow:abc-123" }),
    ).toBe(2500);
  });

  it("logs the rows left unstamped, naming the box, and carries on", async () => {
    await outbox.insertOne(statusEvent());
    await inbox.insertMany([inboxRow(), inboxRow()]);
    const warn = vi.spyOn(logger, "warn");

    await expect(up(droppingWritesTo("inbox"))).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "2 inbox rows were left unstamped",
    );
    expect(await outbox.findOne()).toHaveProperty(
      "eventType",
      "CaseStatusUpdated",
    );
    expect(await inbox.countDocuments({ eventType: null })).toBe(2);
  });
});
