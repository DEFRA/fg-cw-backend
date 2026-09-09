import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let client;
let db;

const keysOf = async (collection) => {
  const indexes = await db.collection(collection).indexes();

  return indexes.map((index) => index.key);
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
});

afterAll(async () => {
  await client?.close(true);
});

// migrations run on boot (src/main.js), so by the time the stack is healthy
// the actuator sort indexes must exist - without them these endpoints do a
// collection scan with an in-memory sort
describe("actuator event indexes", () => {
  it("indexes the inbox newest-first sort with an _id tie-break", async () => {
    expect(await keysOf("inbox")).toContainEqual({ eventTime: -1, _id: -1 });
  });

  it("indexes the inbox status filter with the same sort", async () => {
    expect(await keysOf("inbox")).toContainEqual({
      status: 1,
      eventTime: -1,
      _id: -1,
    });
  });

  it("indexes the outbox newest-first sort with an _id tie-break", async () => {
    expect(await keysOf("outbox")).toContainEqual({
      publicationDate: -1,
      _id: -1,
    });
  });

  it("indexes the outbox status filter with the same sort", async () => {
    expect(await keysOf("outbox")).toContainEqual({
      status: 1,
      publicationDate: -1,
      _id: -1,
    });
  });
});
