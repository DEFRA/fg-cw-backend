import { MongoServerError, ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../common/mongo-client.js";
import { AccessToken } from "../models/access-token.js";
import {
  deleteInactiveToken,
  findAll,
  findByClient,
  findCredentialByHash,
  findTokenOfClient,
  insertToken,
  saveTokenChanges,
} from "./access-token.repository.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/actuator-read.js", () => ({
  actuatorReadMaxTimeMs: () => 3000,
}));

const HASH = "a".repeat(64);
const TOKEN_ID = "6650c1f2a9e4b1d07c20bd91";
const NOW = new Date("2026-11-04T12:00:00.000Z");
const session = { id: "session" };

let collection;

const cursor = (rows) => {
  const self = {
    sort: vi.fn(() => self),
    limit: vi.fn(() => self),
    toArray: vi.fn().mockResolvedValue(rows),
  };

  return self;
};

const aDoc = () => ({
  _id: new ObjectId(TOKEN_ID),
  client: "grants-ui",
  expiresAt: null,
});

beforeEach(() => {
  collection = {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn(() => cursor([aDoc()])),
    aggregate: vi.fn(() => cursor([{ ...aDoc(), id: "aaa••••••aaa" }])),
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  db.collection.mockReturnValue(collection);
});

describe("access token repository", () => {
  // A revoke must stop the token on the next request, so auth may not read a
  // secondary that has not seen it yet; primaryPreferred still answers during
  // an election, when primary would stall every authenticated request.
  it("looks a credential up by hash on the primary when there is one", async () => {
    await findCredentialByHash(HASH);

    expect(db.collection).toHaveBeenCalledWith("access_tokens");
    expect(collection.findOne).toHaveBeenCalledWith(
      { id: HASH },
      { readPreference: "primaryPreferred" },
    );
  });

  it("leaves the hash out of what findByClient reads, from the primary", async () => {
    await findByClient("grants-ui");

    const [, options] = collection.find.mock.calls[0];

    expect(options.projection).toEqual({ id: 0 });
    expect(options.readPreference).toBe("primary");
    expect(options.maxTimeMS).toBe(3000);
  });

  it("lists up to 500 rows from the primary, each hash masked by Mongo", async () => {
    await findAll();

    expect(collection.find).not.toHaveBeenCalled();
    expect(collection.aggregate).toHaveBeenCalledWith(
      [
        {
          $set: {
            id: {
              $concat: [
                { $substrCP: ["$id", 0, 3] },
                "••••••",
                { $substrCP: ["$id", 61, 3] },
              ],
            },
          },
        },
      ],
      { readPreference: "primary", maxTimeMS: 3000 },
    );
  });

  it("lists each token with its row as stored", async () => {
    const [{ token, stored }] = await findAll();

    expect(token).toBeInstanceOf(AccessToken);
    expect(token.tokenId).toBe(TOKEN_ID);
    expect(stored).toEqual({
      _id: { $oid: TOKEN_ID },
      id: "aaa••••••aaa",
      client: "grants-ui",
      expiresAt: null,
    });
  });

  it("reads a client's rows in the caller's transaction", async () => {
    await findByClient("grants-ui", session);

    const [filter, options] = collection.find.mock.calls[0];

    expect(filter).toEqual({ client: "grants-ui" });
    expect(options.session).toBe(session);
  });

  it("finds a token only under its own client's name, without the hash", async () => {
    collection.findOne.mockResolvedValue(aDoc());

    const token = await findTokenOfClient("grants-ui", TOKEN_ID, session);

    expect(token.tokenId).toBe(TOKEN_ID);
    expect(collection.findOne).toHaveBeenCalledWith(
      { _id: new ObjectId(TOKEN_ID), client: "grants-ui" },
      { projection: { id: 0 }, readPreference: "primary", session },
    );
  });

  it("answers null for a token the client does not have", async () => {
    expect(await findTokenOfClient("grants-ui", TOKEN_ID)).toBeNull();
  });

  it("inserts an issued token with its hash, in the transaction", async () => {
    const token = AccessToken.issue({
      clientId: "grants-ui",
      tokenHint: "x9Q_",
      by: "Jane",
      now: NOW,
    });

    await insertToken({ token, hash: HASH }, session);

    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ id: HASH, client: "grants-ui" }),
      { session },
    );
  });

  it("turns a duplicate hash into a 409 that never quotes Mongo", async () => {
    const error = new MongoServerError({
      message: `E11000 duplicate key error dup key: { id: "${HASH}" }`,
    });
    error.code = 11000;
    collection.insertOne.mockRejectedValue(error);

    const refusal = await insertToken(
      { token: AccessToken.createMock(), hash: HASH },
      session,
    ).catch((e) => e);

    expect(refusal.output.statusCode).toBe(409);
    expect(refusal.output.payload.errorCode).toBe("API_TOKEN_DUPLICATE");
    expect(JSON.stringify(refusal.output.payload)).not.toContain(HASH);
    expect(refusal.message).not.toContain(HASH);
  });

  it("passes any other insert failure on", async () => {
    const error = new Error("down");
    collection.insertOne.mockRejectedValue(error);

    await expect(
      insertToken({ token: AccessToken.createMock(), hash: HASH }, session),
    ).rejects.toBe(error);
  });

  describe("saveTokenChanges", () => {
    const changes = { revokedAt: NOW, revokedBy: "Sam", expiresAt: NOW };
    const REVOKED_AT = new Date("2026-01-01T00:00:00.000Z");

    const save = (asRead = { revokedAt: null, expiresAt: null }) =>
      saveTokenChanges(
        { clientId: "grants-ui", tokenId: TOKEN_ID, asRead, changes },
        session,
      );

    it("matches only this client's row, as it was read", async () => {
      await save({ revokedAt: REVOKED_AT, expiresAt: REVOKED_AT });

      expect(collection.updateOne.mock.calls[0][0]).toEqual({
        _id: new ObjectId(TOKEN_ID),
        client: "grants-ui",
        revokedAt: REVOKED_AT,
        expiresAt: REVOKED_AT,
      });
    });

    it("writes only what changed", async () => {
      await save();

      const [, update, options] = collection.updateOne.mock.calls[0];

      expect(update).toEqual({ $set: changes });
      expect(options).toEqual({ session });
    });

    it.each([
      [1, true],
      [0, false],
    ])("answers whether a row matched (%s)", async (matchedCount, saved) => {
      collection.updateOne.mockResolvedValue({ matchedCount });

      expect(await save()).toBe(saved);
    });
  });

  describe("deleteInactiveToken", () => {
    const remove = () =>
      deleteInactiveToken(
        { clientId: "grants-ui", tokenId: TOKEN_ID, now: NOW },
        session,
      );

    it("deletes only this client's row, and only while it is not active", async () => {
      await remove();

      expect(collection.deleteOne).toHaveBeenCalledWith(
        {
          _id: new ObjectId(TOKEN_ID),
          client: "grants-ui",
          $or: [{ revokedAt: { $ne: null } }, { expiresAt: { $lte: NOW } }],
        },
        { session },
      );
    });

    it.each([
      [1, true],
      [0, false],
    ])("answers whether it went (%s)", async (deletedCount, deleted) => {
      collection.deleteOne.mockResolvedValue({ deletedCount });

      expect(await remove()).toBe(deleted);
    });
  });
});
