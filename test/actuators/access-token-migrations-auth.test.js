import { MongoClient, ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { up as normaliseDates } from "../../migrations/20261104115000-normalise-access-token-dates.js";
import { up as allowSeveralPerClient } from "../../migrations/20261104120000-allow-several-access-tokens-per-client.js";
import { up as rekeyAccessTokens } from "../../migrations/20261104125000-rekey-access-tokens.js";
import { up as nameAccessTokens } from "../../migrations/20261104130000-name-access-tokens.js";
import { up as backfillCreatedAt } from "../../migrations/20261104140000-backfill-access-token-created-at.js";
import { hashToken } from "../../src/server/plugins/auth/hash-token.js";
import { wreck } from "../helpers/wreck.js";

let client;
let db;
let accessTokens;
const inserted = [];

const insertToken = async (fields) => {
  const raw = randomBytes(32).toString("base64url");
  const _id = new ObjectId();
  const id = hashToken(raw);
  await accessTokens.insertOne({
    _id,
    id,
    expiresAt: null,
    ...fields,
  });
  inserted.push(id);

  return { raw, _id, id };
};

const rolesStatus = async (raw) => {
  try {
    const { res } = await wreck.get(
      "/api/users/00000000-0000-0000-0000-000000000000/roles",
      { headers: { authorization: `Bearer ${raw}` } },
    );

    return res.statusCode;
  } catch (error) {
    return error.output.statusCode;
  }
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  accessTokens = db.collection("access_tokens");
});

afterAll(async () => {
  await accessTokens.deleteMany({ id: { $in: inserted } });
  await client?.close(true);
});

// Run again here against the service's own store: each is idempotent, and
// the tokens a consumer already holds must keep working through them.
describe("tokens through the FGP-1572 migrations", () => {
  it("keeps whether a token authenticates when it normalises its expiry", async () => {
    const working = await insertToken({
      client: "it-word",
      expiresAt: "never",
    });
    const stopped = await insertToken({ client: "it-negative", expiresAt: -1 });

    await normaliseDates(db);

    expect((await accessTokens.findOne({ _id: working._id })).expiresAt).toBe(
      null,
    );
    expect(await rolesStatus(working.raw)).toBe(200);
    expect(await rolesStatus(stopped.raw)).toBe(401);
  });

  it("keeps authenticating a client's tokens once it may hold several", async () => {
    const first = await insertToken({ client: "it-several" });
    const second = await insertToken({ client: "it-several" });

    await allowSeveralPerClient(db);

    expect(await rolesStatus(first.raw)).toBe(200);
    expect(await rolesStatus(second.raw)).toBe(200);
  });

  it("keeps authenticating a token it re-keys", async () => {
    const handMade = await insertToken({ _id: "it-hand-made", client: "it-x" });

    await rekeyAccessTokens(db, client);

    const { _id } = await accessTokens.findOne({ id: handMade.id });

    expect(_id).toBeInstanceOf(ObjectId);
    expect(await rolesStatus(handMade.raw)).toBe(200);
  });

  it("keeps authenticating a token it renames", async () => {
    const nameless = await insertToken({});
    const badName = await insertToken({ client: "IT_Bad_Name" });

    await nameAccessTokens(db);

    expect((await accessTokens.findOne({ _id: nameless._id })).client).toBe(
      `unnamed-${nameless._id.toHexString().slice(-6)}`,
    );
    expect((await accessTokens.findOne({ _id: badName._id })).client).toBe(
      "it-bad-name",
    );
    expect(await rolesStatus(nameless.raw)).toBe(200);
    expect(await rolesStatus(badName.raw)).toBe(200);
  });

  it("keeps authenticating a token it dates", async () => {
    const legacy = await insertToken({ client: "it-legacy" });

    await backfillCreatedAt(db);

    expect((await accessTokens.findOne({ _id: legacy._id })).createdAt).toEqual(
      legacy._id.getTimestamp(),
    );
    expect(await rolesStatus(legacy.raw)).toBe(200);
  });
});
