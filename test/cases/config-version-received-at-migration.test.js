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
import { logger } from "../../src/common/logger.js";
import { up } from "../../migrations/20261021100000-normalise-config-version-received-at.js";

const GRANT_CODE = "migration-received-at";
const INSERTED_AT = new Date("2026-01-02T03:04:05.000Z");

let client;
let db;
let configVersions;

const idAt = (date) => ObjectId.createFromTime(date.getTime() / 1000);

const aVersion = (overrides) => ({
  _id: new ObjectId(),
  grantCode: GRANT_CODE,
  version: new ObjectId().toString(),
  status: "active",
  fetchStatus: "fetched",
  ...overrides,
});

const normalised = (count, left = 0) =>
  `Normalised ${count} config version receivedAt values to ISO strings, ${left} not an instant left as stored`;

const receivedAtOf = async (_id) =>
  (await configVersions.findOne({ _id })).receivedAt;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  configVersions = db.collection("config_versions");
});

afterAll(async () => {
  await configVersions.deleteMany({ grantCode: GRANT_CODE });
  await client?.close(true);
});

beforeEach(async () => {
  vi.restoreAllMocks();
  await configVersions.deleteMany({ grantCode: GRANT_CODE });
});

describe("20261021100000-normalise-config-version-received-at", () => {
  it("leaves a canonical string untouched", async () => {
    const info = vi.spyOn(logger, "info");
    const doc = aVersion({ receivedAt: "2026-06-16T10:00:00.000Z" });
    await configVersions.insertOne(doc);

    await up(db);

    expect(await receivedAtOf(doc._id)).toBe("2026-06-16T10:00:00.000Z");
    expect(info).toHaveBeenCalledWith(normalised(0));
  });

  it.each([
    [
      "a BSON Date",
      new Date("2026-06-16T10:02:00.000Z"),
      "2026-06-16T10:02:00.000Z",
    ],
    [
      "an offset string",
      "2026-06-16T11:01:00+01:00",
      "2026-06-16T10:01:00.000Z",
    ],
    [
      "a string without milliseconds",
      "2026-06-16T10:03:00Z",
      "2026-06-16T10:03:00.000Z",
    ],
  ])(
    "normalises %s to a canonical ISO string",
    async (_name, stored, expected) => {
      const info = vi.spyOn(logger, "info");
      const doc = aVersion({ receivedAt: stored });
      await configVersions.insertOne(doc);

      await up(db);

      expect(await receivedAtOf(doc._id)).toBe(expected);
      expect(info).toHaveBeenCalledWith(normalised(1));
    },
  );

  it.each([
    ["missing, as on a seeded 0.0.0 version", {}],
    ["null", { receivedAt: null }],
  ])("takes the _id time when %s", async (_name, overrides) => {
    const doc = aVersion({ _id: idAt(INSERTED_AT), ...overrides });
    await configVersions.insertOne(doc);

    await up(db);

    expect(await receivedAtOf(doc._id)).toBe(INSERTED_AT.toISOString());
  });

  it("leaves a value that is no instant as stored, and counts it", async () => {
    const info = vi.spyOn(logger, "info");
    const docs = [
      aVersion({ receivedAt: "not a date" }),
      aVersion({ receivedAt: "2026-13-45" }),
      aVersion({ receivedAt: "2026-13-45T10:00:00.000Z" }),
    ];
    await configVersions.insertMany(docs);

    await up(db);

    expect(await receivedAtOf(docs[0]._id)).toBe("not a date");
    expect(await receivedAtOf(docs[1]._id)).toBe("2026-13-45");
    expect(await receivedAtOf(docs[2]._id)).toBe("2026-13-45T10:00:00.000Z");
    expect(info).toHaveBeenCalledWith(normalised(0, 3));
  });

  it("changes nothing the second time", async () => {
    const info = vi.spyOn(logger, "info");
    const doc = aVersion({ receivedAt: new Date("2026-06-16T10:02:00.000Z") });
    await configVersions.insertOne(doc);

    await up(db);
    await up(db);

    expect(await receivedAtOf(doc._id)).toBe("2026-06-16T10:02:00.000Z");
    expect(info).toHaveBeenLastCalledWith(normalised(0));
  });
});
