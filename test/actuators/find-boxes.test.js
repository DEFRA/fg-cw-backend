import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findBoxes } from "../helpers/actuators.js";
import { SERVICE_CLIENT, SERVICE_TOKEN } from "../helpers/service-token.js";
import { TestUser, getTokenFor } from "../helpers/users.js";

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

describe("GET /actuators/boxes", () => {
  it("answers a caller holding the seeded service token", async () => {
    const response = await findBoxes();

    expect(response.res.statusCode).toBe(200);
    expect(response.payload).toEqual({ boxes: [], caller: SERVICE_CLIENT });
  });

  it("rejects an unknown token", async () => {
    await expect(findBoxes("Bearer not-a-real-token")).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("rejects a valid Entra user token", async () => {
    const token = await getTokenFor(TestUser.Admin.email);

    await expect(findBoxes(`Bearer ${token}`)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("rejects a request with no token", async () => {
    await expect(findBoxes(null)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });
});
