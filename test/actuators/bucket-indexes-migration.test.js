import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { up } from "../../migrations/20261009140000-build-bucket-indexes.js";

let client;
let db;

const indexesOf = (collection) => db.collection(collection).indexes();

const keysOf = async (collection) =>
  (await indexesOf(collection)).map(({ key }) => key);

const KEYS = {
  outbox: [
    { eventType: 1, publicationDate: -1, _id: -1 },
    { eventType: 1, status: 1, publicationDate: -1, _id: -1 },
    {
      eventType: 1,
      status: 1,
      "lastError.name": 1,
      publicationDate: -1,
      _id: -1,
    },
    { eventType: 1, status: 1, errorKey: 1, publicationDate: -1, _id: -1 },
    { eventType: 1, refs: 1, publicationDate: -1, _id: -1 },
  ],
  inbox: [
    { publicationDate: -1, _id: -1 },
    { status: 1, publicationDate: -1, _id: -1 },
    { status: 1, eventType: 1, publicationDate: -1, _id: -1 },
    { status: 1, "lastError.name": 1, publicationDate: -1, _id: -1 },
    {
      status: 1,
      errorKey: 1,
      eventType: 1,
      publicationDate: -1,
      _id: -1,
    },
    { refs: 1, publicationDate: -1, _id: -1 },
  ],
  cases: [
    { createdAt: -1, _id: -1 },
    { workflowCode: 1, createdAt: -1, _id: -1 },
    { refs: 1, createdAt: -1, _id: -1 },
  ],
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
});

afterAll(async () => {
  await client?.close(true);
});

describe("20261009140000-build-bucket-indexes", () => {
  it.each(Object.entries(KEYS))(
    "leaves %s with every key its buckets read by, none partial or sparse",
    async (collection, keys) => {
      await up(db);

      const indexes = await indexesOf(collection);

      for (const key of keys) {
        const index = indexes.find(
          (candidate) => JSON.stringify(candidate.key) === JSON.stringify(key),
        );

        expect(index).toMatchObject({ key });
        expect(index).not.toHaveProperty("partialFilterExpression");
        expect(index).not.toHaveProperty("sparse");
      }
    },
  );

  it("keeps the inbox list index that was there instead of building a second", async () => {
    const before = await indexesOf("inbox");

    await up(db);

    const after = await indexesOf("inbox");

    expect(after.slice(0, before.length)).toEqual(before);
    expect(
      after.filter(
        ({ key }) =>
          JSON.stringify(key) ===
          JSON.stringify({ publicationDate: -1, _id: -1 }),
      ),
    ).toHaveLength(1);
  });

  it("builds nothing and drops nothing the second time", async () => {
    await up(db);
    const before = await keysOf("outbox");

    await up(db);

    expect(await keysOf("outbox")).toEqual(before);
  });
});
