import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { up } from "../../migrations/20261021110000-build-workflows-bucket-indexes.js";

let client;
let db;

const indexesOf = () => db.collection("config_versions").indexes();

const KEYS = [
  { receivedAt: -1, _id: -1 },
  { grantCode: 1, status: 1, fetchStatus: 1, receivedAt: -1, _id: -1 },
  { status: 1, fetchStatus: 1, receivedAt: -1, _id: -1 },
  { refs: 1, receivedAt: -1, _id: -1 },
];

const isKey = (key) => (index) =>
  JSON.stringify(index.key) === JSON.stringify(key);

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
});

afterAll(async () => {
  await client?.close(true);
});

describe("20261021110000-build-workflows-bucket-indexes", () => {
  it("leaves config_versions with every key the workflows list reads by, none partial or sparse", async () => {
    await up(db);

    const indexes = await indexesOf();

    for (const key of KEYS) {
      const index = indexes.find(isKey(key));

      expect(index).toMatchObject({ key });
      expect(index).not.toHaveProperty("partialFilterExpression");
      expect(index).not.toHaveProperty("sparse");
    }
  });

  it("keeps the config version indexes that were there", async () => {
    await up(db);

    const keys = (await indexesOf()).map(({ key }) => key);

    expect(keys).toEqual(
      expect.arrayContaining([
        { grantCode: 1, version: 1 },
        { grantCode: 1, major: 1, minor: 1, patch: -1, status: 1 },
      ]),
    );
  });

  it("builds nothing and drops nothing the second time", async () => {
    await up(db);
    const before = await indexesOf();

    await up(db);

    expect(await indexesOf()).toEqual(before);
    for (const key of KEYS) {
      expect((await indexesOf()).filter(isKey(key))).toHaveLength(1);
    }
  });
});
