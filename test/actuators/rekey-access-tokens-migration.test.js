import { Collection, MongoClient, ObjectId } from "mongodb";
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
import { up } from "../../migrations/20261104125000-rekey-access-tokens.js";
import { logger } from "../../src/common/logger.js";

// A database of its own, so the service's live tokens are never touched.
const DATABASE = "rekey-access-tokens-migration";

const RECORDED = new Date("2026-11-04T09:30:00.000Z");

let client;
let db;
let accessTokens;
let n = 0;

const aRow = (fields) => {
  n += 1;

  return {
    id: String(n).padStart(64, "0"),
    client: "fg-gas-backend",
    expiresAt: null,
    ...fields,
  };
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db(DATABASE);
  accessTokens = db.collection("access_tokens");
  await accessTokens.createIndex({ id: 1 }, { unique: true });
});

afterAll(async () => {
  await db.dropDatabase();
  await client?.close(true);
});

beforeEach(async () => {
  await accessTokens.deleteMany({});
  vi.restoreAllMocks();
});

describe("20261104125000-rekey-access-tokens", () => {
  it.each([
    ["a string", "hand-made"],
    ["a number", 7],
  ])(
    "moves a row keyed by %s to an ObjectId, keeping every field",
    async (_, _id) => {
      const row = aRow({ _id, createdAt: RECORDED, createdBy: "Jane" });
      await accessTokens.insertOne(row);

      await up(db, client);

      const { _id: rekeyed, ...fields } = await accessTokens.findOne({
        id: row.id,
      });

      expect(rekeyed).toBeInstanceOf(ObjectId);
      expect(await accessTokens.findOne({ _id })).toBeNull();
      expect(fields).toEqual({
        id: row.id,
        client: "fg-gas-backend",
        expiresAt: null,
        createdAt: RECORDED,
        createdBy: "Jane",
      });
    },
  );

  it("records an unknown createdAt rather than date it from the new key", async () => {
    const row = aRow({ _id: "hand-made" });
    await accessTokens.insertOne(row);

    await up(db, client);

    expect((await accessTokens.findOne({ id: row.id })).createdAt).toBeNull();
  });

  it("finds the rows to move on the primary, never a lagging secondary", async () => {
    const find = vi.spyOn(Collection.prototype, "find");
    const findOneAndDelete = vi.spyOn(Collection.prototype, "findOneAndDelete");
    await accessTokens.insertOne(aRow({ _id: "hand-made" }));

    await up(db, client);

    expect(find.mock.calls[0][1]).toMatchObject({ readPreference: "primary" });
    expect(findOneAndDelete.mock.calls[0][1]).toHaveProperty("session");
  });

  it("leaves a row keyed by an ObjectId alone", async () => {
    const row = aRow({ _id: new ObjectId() });
    await accessTokens.insertOne(row);

    await up(db, client);

    expect(await accessTokens.find().toArray()).toEqual([row]);
  });

  it("logs the count, and changes nothing when run again", async () => {
    await accessTokens.insertMany([
      aRow({ _id: "hand-made" }),
      aRow({ _id: new ObjectId() }),
    ]);
    const info = vi.spyOn(logger, "info");

    await up(db, client);
    const once = await accessTokens.find().toArray();
    await up(db, client);

    expect(info.mock.calls).toEqual([
      ["Re-keyed 1 access tokens to an ObjectId"],
      ["Re-keyed 0 access tokens to an ObjectId"],
    ]);
    expect(await accessTokens.find().toArray()).toEqual(once);
  });
});
