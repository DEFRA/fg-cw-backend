import { BSON, Double, Int32, Long, ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccessToken } from "../../src/clients/models/access-token.js";
import {
  deleteInactiveToken,
  findAll,
  findTokenOfClient,
  saveTokenChanges,
} from "../../src/clients/repositories/access-token.repository.js";
import { db, mongoClient } from "../../src/common/mongo-client.js";

const CLIENT = "it-repository";
const NOW = new Date();
const PAST = new Date(NOW.getTime() - 60_000);

let tokens;

const insert = async (fields = {}) => {
  const _id = new ObjectId();
  await tokens.insertOne({
    _id,
    id: new ObjectId().toHexString().padEnd(64, "0"),
    client: CLIENT,
    expiresAt: null,
    ...fields,
  });

  return _id.toHexString();
};

const read = (tokenId) => findTokenOfClient(CLIENT, tokenId);

beforeAll(async () => {
  await mongoClient.connect();
  tokens = db.collection("access_tokens");
});

beforeEach(async () => {
  await tokens.deleteMany({ client: CLIENT });
});

afterAll(async () => {
  await tokens.deleteMany({ client: CLIENT });
  await mongoClient.close();
});

// The caller-token rule is the model's; what the store guarantees is that a
// change lands only on the row as it was read.
describe("the access token store's conditional writes", () => {
  it("refuses a revoke of the caller's own row before any write", async () => {
    const tokenId = await insert();
    const token = await read(tokenId);

    expect(() =>
      token.revoke({ by: "Sam", now: NOW, callerTokenId: tokenId }),
    ).toThrow(expect.objectContaining({ output: expect.anything() }));
    expect((await read(tokenId)).revokedAt).toBeNull();
  });

  it("refuses an expiry change ending the caller's own row before any write", async () => {
    const tokenId = await insert();
    const token = await read(tokenId);

    expect(() =>
      token.changeExpiry({ expiresAt: PAST, now: NOW, callerTokenId: tokenId }),
    ).toThrow();
    expect((await read(tokenId)).expiresAt).toBeNull();
  });

  it("saves a change onto the row as it was read", async () => {
    const tokenId = await insert();
    const { asRead, changes } = (await read(tokenId)).revoke({
      by: "Sam",
      now: NOW,
      callerTokenId: null,
    });

    expect(
      await saveTokenChanges({ clientId: CLIENT, tokenId, asRead, changes }),
    ).toBe(true);
    expect((await read(tokenId)).revokedBy).toBe("Sam");
  });

  it.each([
    ["revoked meanwhile", { $set: { revokedAt: NOW, expiresAt: NOW } }],
    [
      "given another expiry meanwhile",
      { $set: { expiresAt: new Date(2999, 0) } },
    ],
  ])("matches nothing once the row was %s", async (_, meanwhile) => {
    const tokenId = await insert();
    const { asRead, changes } = (await read(tokenId)).revoke({
      by: "Sam",
      now: NOW,
      callerTokenId: null,
    });
    await tokens.updateOne({ _id: new ObjectId(tokenId) }, meanwhile);
    const before = await tokens.findOne({ _id: new ObjectId(tokenId) });

    expect(
      await saveTokenChanges({ clientId: CLIENT, tokenId, asRead, changes }),
    ).toBe(false);
    expect(await tokens.findOne({ _id: new ObjectId(tokenId) })).toEqual(
      before,
    );
  });

  it("never deletes an active row, and deletes an inactive one", async () => {
    const active = await insert();
    const revoked = await insert({ revokedAt: PAST, expiresAt: PAST });

    expect(
      await deleteInactiveToken({
        clientId: CLIENT,
        tokenId: active,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      await deleteInactiveToken({
        clientId: CLIENT,
        tokenId: revoked,
        now: NOW,
      }),
    ).toBe(true);
    expect(await read(active)).toBeInstanceOf(AccessToken);
    expect(await read(revoked)).toBeNull();
  });
});

describe("the access token list", () => {
  const HASH = "0123456789abcdef".repeat(4);

  it("reads each row as its own bytes, every type kept, its hash masked by Mongo", async () => {
    const tokenId = await insert({
      id: HASH,
      count: new Int32(1),
      total: Long.fromNumber(2),
      ratio: new Double(3),
      createdAt: PAST,
    });

    const listed = (await findAll()).find(
      ({ token }) => token.tokenId === tokenId,
    );
    const bytes = Buffer.from(listed.document, "base64");
    const [stored] = await tokens
      .find({ _id: new ObjectId(tokenId) }, { raw: true })
      .toArray();

    const asStored = BSON.deserialize(Buffer.from(stored), {
      promoteValues: false,
    });

    expect(listed.token.clientId).toBe(CLIENT);
    expect(
      bytes.equals(BSON.serialize({ ...asStored, id: "012••••••def" })),
    ).toBe(true);
    expect(bytes.includes(Buffer.from("012••••••def"))).toBe(true);
    expect(bytes.includes(Buffer.from(HASH))).toBe(false);
  });
});
