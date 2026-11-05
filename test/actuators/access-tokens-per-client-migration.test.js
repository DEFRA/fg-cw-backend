import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { up as createTokenIndexes } from "../../migrations/20260826120000-service-access-tokens.js";
import { up } from "../../migrations/20261104120000-allow-several-access-tokens-per-client.js";

// A database of its own, so the service's live tokens are never touched.
const DATABASE = "access-tokens-migration";

let client;
let db;
let accessTokens;

const aRow = (client, n) => ({
  id: String(n).repeat(64),
  client,
  expiresAt: null,
});

const indexNamed = async (name) =>
  (await accessTokens.indexes()).find((index) => index.name === name);

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db(DATABASE);
});

afterAll(async () => {
  await db.dropDatabase();
  await client?.close(true);
});

beforeEach(async () => {
  await db.dropDatabase();
  accessTokens = db.collection("access_tokens");
  await createTokenIndexes(db);
  await accessTokens.insertMany([
    aRow("fg-gas-backend", 1),
    aRow("grants-ui", 2),
  ]);
});

describe("20261104120000-allow-several-access-tokens-per-client", () => {
  it("lets a client hold several tokens", async () => {
    await up(db);

    await expect(
      accessTokens.insertOne(aRow("fg-gas-backend", 3)),
    ).resolves.toBeDefined();
  });

  it("keeps the hash unique", async () => {
    await up(db);

    await expect(
      accessTokens.insertOne(aRow("another-client", 1)),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("replaces the unique client index with a plain one", async () => {
    await up(db);

    const clientIndex = await indexNamed("client_1");

    expect(clientIndex.key).toEqual({ client: 1 });
    expect(clientIndex.unique).toBeUndefined();
  });

  it("leaves every row as it was", async () => {
    const before = await accessTokens.find().toArray();

    await up(db);

    expect(await accessTokens.find().toArray()).toEqual(before);
  });

  it("indexes expiry, as fg-gas-backend does", async () => {
    await up(db);

    expect((await indexNamed("expiresAt_1")).key).toEqual({ expiresAt: 1 });
  });

  it("can run again", async () => {
    await up(db);

    await expect(up(db)).resolves.toBeUndefined();
    expect((await indexNamed("client_1")).unique).toBeUndefined();
  });

  it("runs on an empty collection", async () => {
    await accessTokens.deleteMany({});

    await expect(up(db)).resolves.toBeUndefined();
  });
});
