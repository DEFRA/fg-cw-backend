import { ObjectId } from "mongodb";
import { logger } from "../src/common/logger.js";
import { transactionOptions } from "../src/common/with-transaction.js";

// FGP-1572: a token is addressed by an ObjectId, so a row keyed by anything
// else moves to a new one. The new key says nothing about when the token was
// first seeded, so a row without createdAt records it as unknown.
const notObjectId = { _id: { $not: { $type: "objectId" } } };

// Removed and reinserted in one transaction: the hash is unique, and a write
// to the row in between is carried over rather than lost. The row is read in
// the transaction, from the primary, so it is moved as the earlier migrations
// left it.
const rekey = async (accessTokens, _id, session) => {
  const row = await accessTokens.findOneAndDelete({ _id }, { session });

  if (!row) {
    return 0;
  }

  await accessTokens.insertOne(
    { createdAt: null, ...row, _id: new ObjectId() },
    { session },
  );

  return 1;
};

export const up = async (db, client) => {
  const accessTokens = db.collection("access_tokens");
  const rows = await accessTokens
    .find(notObjectId, { projection: { _id: 1 }, readPreference: "primary" })
    .toArray();
  let rekeyed = 0;

  for (const { _id } of rows) {
    let moved = 0;

    await client.withSession((session) =>
      session.withTransaction(async () => {
        moved = await rekey(accessTokens, _id, session);
      }, transactionOptions),
    );

    rekeyed += moved;
  }

  logger.info(`Re-keyed ${rekeyed} access tokens to an ObjectId`);
};
