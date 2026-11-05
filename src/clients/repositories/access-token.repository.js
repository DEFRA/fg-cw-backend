import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { actuatorReadMaxTimeMs } from "../../common/actuator-read.js";
import { db } from "../../common/mongo-client.js";
import { withErrorCode } from "../../common/with-error-code.js";
import { apiClientErrors } from "../models/access-token.js";
import { HASH_EDGE, HASH_LENGTH, HASH_MASK } from "../models/masked-hash.js";
import { AccessTokenDocument } from "./access-token/access-token-document.js";

const collection = "access_tokens";

const MONGO_DUPLICATE_KEY = 11000;

const tokens = () => db.collection(collection);

// Every read below follows, or may follow, a write, so it reads the primary.
// None of them loads the hash, and the list only its masked ends.
const withoutHash = (session) => ({
  projection: { id: 0 },
  readPreference: "primary",
  ...(session ? { session } : {}),
});

// The one read that loads a hash, for auth alone. primaryPreferred, not
// primary: a revoke takes effect on the next request, except briefly during an
// election, which then does not stall every authenticated one.
export const findCredentialByHash = (id) =>
  tokens().findOne({ id }, { readPreference: "primaryPreferred" });

// Masked by Mongo, so the list loads no more of a hash than it shows.
const maskedHash = {
  $concat: [
    { $substrCP: ["$id", 0, HASH_EDGE] },
    HASH_MASK,
    { $substrCP: ["$id", HASH_LENGTH - HASH_EDGE, HASH_EDGE] },
  ],
};

// Each token with its row as stored, the hash masked. Every row: the
// collection is small, and a row left out could not be managed.
export const findAll = async () => {
  const docs = await tokens()
    .aggregate([{ $set: { id: maskedHash } }], {
      readPreference: "primary",
      maxTimeMS: actuatorReadMaxTimeMs(),
    })
    .toArray();

  return docs.map((doc) => ({
    token: AccessTokenDocument.toAccessToken(doc),
    stored: AccessTokenDocument.toStored(doc),
  }));
};

export const findByClient = async (clientId, session) => {
  const docs = await tokens()
    .find(
      { client: clientId },
      { ...withoutHash(session), maxTimeMS: actuatorReadMaxTimeMs() },
    )
    .sort({ _id: -1 })
    .toArray();

  return docs.map(AccessTokenDocument.toAccessToken);
};

// The name is part of the address, so a nameless row is never found here.
export const findTokenOfClient = async (clientId, tokenId, session) => {
  const doc = await tokens().findOne(
    { _id: new ObjectId(tokenId), client: clientId },
    withoutHash(session),
  );

  return doc && AccessTokenDocument.toAccessToken(doc);
};

// A duplicate-key message quotes the hash, so none of it is passed on.
export const insertToken = async ({ token, hash }, session) => {
  try {
    await tokens().insertOne(new AccessTokenDocument({ token, hash }), {
      session,
    });
  } catch (error) {
    if (error.code !== MONGO_DUPLICATE_KEY) {
      throw error;
    }

    throw withErrorCode(
      Boom.conflict("A token with this hash already exists"),
      apiClientErrors.TOKEN_DUPLICATE,
    );
  }
};

// Writes only what a change to one token changed, and only onto the row as it
// was read: revoked or not, and with the expiry it had. Atomic with the write,
// so a change that raced another matches nothing.
export const saveTokenChanges = async (
  { clientId, tokenId, asRead, changes },
  session,
) => {
  const { matchedCount } = await tokens().updateOne(
    {
      _id: new ObjectId(tokenId),
      client: clientId,
      revokedAt: asRead.revokedAt,
      expiresAt: asRead.expiresAt,
    },
    { $set: changes },
    { session },
  );

  return matchedCount === 1;
};

// The one row, and only while it is not active, so a revive that commits first
// leaves it in place. Answers whether it went.
export const deleteInactiveToken = async (
  { clientId, tokenId, now },
  session,
) => {
  const { deletedCount } = await tokens().deleteOne(
    {
      _id: new ObjectId(tokenId),
      client: clientId,
      $or: [{ revokedAt: { $ne: null } }, { expiresAt: { $lte: now } }],
    },
    { session },
  );

  return deletedCount === 1;
};
