import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SERVICE_CLIENT, SERVICE_TOKEN } from "../helpers/service-token.js";

let client;
let accessTokens;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  accessTokens = client.db().collection("access_tokens");
});

afterAll(async () => {
  await client.close(true);
});

describe("access token seeding", () => {
  it("seeds the configured client's access token on boot", async () => {
    const record = await accessTokens.findOne({ client: SERVICE_CLIENT });

    expect(record).toMatchObject({ client: SERVICE_CLIENT, expiresAt: null });
    expect(record.id).not.toBe(SERVICE_TOKEN);
  });
});
