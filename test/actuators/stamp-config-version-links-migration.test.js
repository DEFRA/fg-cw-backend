import { MongoClient, ObjectId } from "mongodb";
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
import { up } from "../../migrations/20261025100000-stamp-config-version-links.js";
import { logger } from "../../src/common/logger.js";

const TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
const MESSAGE_ID = "0b7c1d1e-0000-4000-8000-000000000001";

// A config version event's refs with no grant code stamped.
const STAMPED_REFS = [
  `id:${MESSAGE_ID}`,
  "trace:4bf92f3577b34da6a3ce929d0e0e4736",
];

// A held far-future claim keeps the pollers off the fixtures.
const held = {
  claimedBy: "test-holder",
  claimExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
};

const envelope = (data) => ({
  id: MESSAGE_ID,
  type: "config-version.updated",
  time: "2026-09-01T10:00:00.000Z",
  traceparent: TRACEPARENT,
  data: { version: "1.0.0", status: "active", manifest: [], ...data },
});

const configRow = (overrides) => ({
  source: "ConfigBroker",
  status: "COMPLETED",
  publicationDate: "2026-09-01T10:00:00.000Z",
  messageId: MESSAGE_ID,
  traceparent: TRACEPARENT,
  type: "config-version.updated",
  segregationRef: "woodland-creation",
  ...held,
  event: envelope({ grantCode: "woodland-creation" }),
  eventType: "ConfigVersionUpdated",
  refs: STAMPED_REFS,
  ...overrides,
});

const caseRow = () =>
  configRow({
    type: "cloud.defra.prod.fg-gas-backend.case.create",
    segregationRef: "abc-124-woodland-creation",
    event: {
      id: MESSAGE_ID,
      type: "cloud.defra.prod.fg-gas-backend.case.create",
      data: { caseRef: "abc-124", workflowCode: "woodland-creation" },
    },
    eventType: "CreateCase",
  });

const everyRow = async (collection) =>
  collection.find().sort({ _id: 1 }).toArray();

// Writes to the inbox are counted, and dropped when asked.
const watchingWrites = ({
  drop = false,
  beforeWrite = async () => {},
} = {}) => {
  const writes = [];

  return {
    writes,
    db: {
      collection: (name) =>
        new Proxy(db.collection(name), {
          get: (target, key) =>
            key === "bulkWrite"
              ? async (operations, options) => {
                  writes.push(...operations);
                  await beforeWrite(target);

                  return drop ? {} : target.bulkWrite(operations, options);
                }
              : Reflect.get(target, key, target),
        }),
    },
  };
};

let client;
let db;
let inbox;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  inbox = db.collection("inbox");
});

afterAll(async () => {
  await client?.close(true);
});

beforeEach(async () => {
  await inbox.deleteMany({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("20261025100000-stamp-config-version-links", () => {
  it("stamps a stored config version event with its grant code as a reference, and its code and version as a link", async () => {
    await inbox.insertOne(configRow());

    await up(db);

    expect((await inbox.findOne()).refs).toEqual([
      ...STAMPED_REFS,
      "ref:woodland-creation",
      "config:woodland-creation@1~2e.0~2e.0",
    ]);
  });

  it("adds the version link to a row linked by its code alone", async () => {
    await inbox.insertOne(
      configRow({
        refs: [
          ...STAMPED_REFS,
          "ref:woodland-creation",
          "config:woodland-creation",
        ],
      }),
    );

    await up(db);

    expect((await inbox.findOne()).refs).toEqual([
      ...STAMPED_REFS,
      "ref:woodland-creation",
      "config:woodland-creation",
      "config:woodland-creation@1~2e.0~2e.0",
    ]);
  });

  it("keeps the case of a mixed-case code in the link", async () => {
    await inbox.insertOne(
      configRow({ event: envelope({ grantCode: "Woodland-Creation" }) }),
    );

    await up(db);

    expect((await inbox.findOne()).refs).toEqual(
      expect.arrayContaining([
        "ref:woodland-creation",
        "config:~57.oodland-~43.reation@1~2e.0~2e.0",
      ]),
    );
  });

  it("reads an edited row's original payload, as its writer saw it", async () => {
    await inbox.insertOne(
      configRow({
        event: envelope({ grantCode: "edited-grant" }),
        originalPayload: envelope({ grantCode: "woodland-creation" }),
      }),
    );

    await up(db);

    const { refs } = await inbox.findOne();

    expect(refs).toContain("config:woodland-creation@1~2e.0~2e.0");
    expect(refs).not.toContain("config:edited-grant@1~2e.0~2e.0");
  });

  it("leaves every other event type alone", async () => {
    const row = caseRow();
    await inbox.insertOne(row);

    await up(db);

    expect(await inbox.findOne()).toEqual(row);
  });

  it("stamps the code of a row with no version, and says how many have no link", async () => {
    const info = vi.spyOn(logger, "info");
    await inbox.insertOne(
      configRow({
        event: envelope({ grantCode: "woodland-creation", version: null }),
      }),
    );

    await up(db);

    expect((await inbox.findOne()).refs).toEqual([
      ...STAMPED_REFS,
      "ref:woodland-creation",
    ]);
    expect(info).toHaveBeenCalledWith(
      "1 ConfigVersionUpdated rows lack a grant code or a version, so have no version link",
    );
  });

  it("leaves a row with no grant code alone, and says how many have no link", async () => {
    const info = vi.spyOn(logger, "info");
    const row = configRow({
      segregationRef: "unknown-grant",
      event: envelope({ grantCode: null }),
    });
    await inbox.insertOne(row);

    await up(db);

    expect(await inbox.findOne()).toEqual(row);
    expect(info).toHaveBeenCalledWith(
      "1 ConfigVersionUpdated rows lack a grant code or a version, so have no version link",
    );
  });

  it("leaves a row that was never stamped as it is, and says how many", async () => {
    const warn = vi.spyOn(logger, "warn");
    const row = configRow({ _id: new ObjectId(), refs: null });
    const { refs, ...noRefs } = configRow({ _id: new ObjectId() });
    await inbox.insertMany([row, noRefs]);

    await up(db);

    expect(await inbox.findOne({ _id: row._id })).toEqual(row);
    expect(await inbox.findOne({ _id: noRefs._id })).toEqual(noRefs);
    expect(warn).toHaveBeenCalledWith(
      "2 ConfigVersionUpdated rows were never stamped, so are left as stored",
    );
  });

  it("keeps a ref a live writer already added", async () => {
    await inbox.insertOne(
      configRow({ refs: [...STAMPED_REFS, "ref:woodland-creation"] }),
    );

    await up(db);

    expect((await inbox.findOne()).refs).toEqual([
      ...STAMPED_REFS,
      "ref:woodland-creation",
      "config:woodland-creation@1~2e.0~2e.0",
    ]);
  });

  it("stamps more rows than one batch holds", async () => {
    await inbox.insertMany(
      Array.from({ length: 2500 }, () => configRow({ _id: new ObjectId() })),
    );

    await up(db);

    expect(
      await inbox.countDocuments({
        refs: "config:woodland-creation@1~2e.0~2e.0",
      }),
    ).toBe(2500);
  });

  it("issues no writes when run again, and leaves every row as it was", async () => {
    await inbox.insertMany([
      configRow({ _id: new ObjectId() }),
      configRow({
        _id: new ObjectId(),
        event: envelope({ grantCode: "Woodland-Creation" }),
      }),
      configRow({ _id: new ObjectId(), event: envelope({ grantCode: " " }) }),
      configRow({
        _id: new ObjectId(),
        event: envelope({ grantCode: "woodland-creation", version: null }),
      }),
      { ...caseRow(), _id: new ObjectId() },
    ]);

    await up(db);
    const once = await everyRow(inbox);
    const second = watchingWrites();
    await up(second.db);

    expect(second.writes).toEqual([]);
    expect(await everyRow(inbox)).toEqual(once);
  });

  it("leaves a row written after it started to its writer", async () => {
    await inbox.insertOne(configRow({ _id: new ObjectId() }));
    const late = configRow({ _id: new ObjectId() });

    await up(
      watchingWrites({ beforeWrite: (target) => target.insertOne(late) }).db,
    );

    expect(await inbox.findOne({ _id: late._id })).toEqual(late);
  });

  it("does nothing on an empty inbox", async () => {
    await expect(up(db)).resolves.toBeUndefined();
  });

  it("fails when a row is left without its refs", async () => {
    await inbox.insertMany([
      configRow({ _id: new ObjectId() }),
      configRow({
        _id: new ObjectId(),
        event: envelope({ grantCode: "woodland-creation", version: null }),
      }),
    ]);

    await expect(up(watchingWrites({ drop: true }).db)).rejects.toThrow(
      "2 ConfigVersionUpdated inbox rows were left without their refs",
    );
  });
});
