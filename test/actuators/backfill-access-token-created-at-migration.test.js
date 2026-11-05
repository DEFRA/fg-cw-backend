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
import { up } from "../../migrations/20261104140000-backfill-access-token-created-at.js";
import { logger } from "../../src/common/logger.js";

// A database of its own, so the service's live tokens are never touched.
const DATABASE = "backfill-access-token-created-at";

const FIRST_SEEDED = new Date("2026-08-26T12:00:00.000Z");
const RECORDED = new Date("2026-11-04T09:30:00.000Z");

let client;
let db;
let accessTokens;

const aRow = (fields) => ({
  id: new ObjectId().toHexString().padEnd(64, "0"),
  client: "fg-gas-backend",
  expiresAt: null,
  ...fields,
});

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db(DATABASE);
  accessTokens = db.collection("access_tokens");
});

afterAll(async () => {
  await db.dropDatabase();
  await client?.close(true);
});

beforeEach(async () => {
  await accessTokens.deleteMany({});
  vi.restoreAllMocks();
});

describe("20261104140000-backfill-access-token-created-at", () => {
  it("dates a row with no createdAt from its ObjectId, leaving createdBy unset", async () => {
    const _id = ObjectId.createFromTime(FIRST_SEEDED.getTime() / 1000);
    await accessTokens.insertOne(aRow({ _id }));

    await up(db);

    const row = await accessTokens.findOne({ _id });

    expect(row.createdAt).toEqual(FIRST_SEEDED);
    expect(row).not.toHaveProperty("createdBy");
  });

  it("leaves a row that already has createdAt alone", async () => {
    const _id = ObjectId.createFromTime(FIRST_SEEDED.getTime() / 1000);
    await accessTokens.insertOne(
      aRow({ _id, createdAt: RECORDED, createdBy: "Jane" }),
    );

    await up(db);

    expect(await accessTokens.findOne({ _id })).toMatchObject({
      createdAt: RECORDED,
      createdBy: "Jane",
    });
  });

  it("leaves a row whose createdAt is recorded as unknown", async () => {
    const info = vi.spyOn(logger, "info");
    const _id = new ObjectId();
    await accessTokens.insertOne(aRow({ _id, createdAt: null }));

    await up(db);

    expect((await accessTokens.findOne({ _id })).createdAt).toBeNull();
    expect(info).toHaveBeenCalledWith(
      "Backfilled createdAt on 0 access tokens",
    );
  });

  it("changes nothing when run again", async () => {
    await accessTokens.insertMany([aRow({}), aRow({ createdAt: null })]);
    await up(db);
    const once = await accessTokens.find().toArray();
    const info = vi.spyOn(logger, "info");

    await up(db);

    expect(await accessTokens.find().toArray()).toEqual(once);
    expect(info).toHaveBeenCalledWith(
      "Backfilled createdAt on 0 access tokens",
    );
  });
});
