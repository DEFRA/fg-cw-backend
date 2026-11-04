import { ObjectId } from "mongodb";
import { LAST_EXPIRY } from "../src/clients/models/access-token.js";
import { logger } from "../src/common/logger.js";

// FGP-1572: the grants admin lists a token's dates as stored, and accepts only
// a date from 1970 to 9999, or null. Any other value is normalised, keeping
// when auth stops accepting the token. Auth never expires a falsy expiry, and
// compares any other with now as a number, so one that reads as a time in
// that range becomes that date, one before it now, and any other never. Any
// revokedAt but null revokes, so it becomes now. A createdAt becomes the time
// its ObjectId was made, or unknown.
const EPOCH = new Date(0);
const DATES = ["expiresAt", "revokedAt", "createdAt"];

// Aggregation's $type, which unlike the query operator never matches an array
// by its elements.
const isUnlisted = (field) => ({
  $and: [
    { $not: [{ $in: [{ $type: `$${field}` }, ["missing", "null"]] }] },
    {
      $not: [
        {
          $and: [
            { $eq: [{ $type: `$${field}` }, "date"] },
            { $gte: [`$${field}`, EPOCH] },
            { $lte: [`$${field}`, LAST_EXPIRY] },
          ],
        },
      ],
    },
  ],
});

const isListed = (value) =>
  value == null ||
  (value instanceof Date && value >= EPOCH && value <= LAST_EXPIRY);

const expiryOf = ({ expiresAt }, now) => {
  const time = Number(expiresAt);

  if (!expiresAt || Number.isNaN(time) || time > LAST_EXPIRY.getTime()) {
    return null;
  }

  return time < 0 ? now : new Date(time);
};

const normalisers = {
  expiresAt: expiryOf,
  revokedAt: (_row, now) => now,
  createdAt: ({ _id }) => (_id instanceof ObjectId ? _id.getTimestamp() : null),
};

const normalise = (row, now) => {
  const fields = DATES.filter((field) => !isListed(row[field]));

  return {
    updateOne: {
      filter: { _id: row._id, $expr: { $and: fields.map(isUnlisted) } },
      update: {
        $set: Object.fromEntries(
          fields.map((field) => [field, normalisers[field](row, now)]),
        ),
      },
    },
  };
};

export const up = async (db) => {
  const accessTokens = db.collection("access_tokens");
  const now = new Date();
  const rows = await accessTokens
    .find(
      { $expr: { $or: DATES.map(isUnlisted) } },
      { projection: { _id: 1, expiresAt: 1, revokedAt: 1, createdAt: 1 } },
    )
    .toArray();
  let normalised = 0;

  if (rows.length > 0) {
    ({ modifiedCount: normalised } = await accessTokens.bulkWrite(
      rows.map((row) => normalise(row, now)),
    ));
  }

  logger.info(`Normalised the dates of ${normalised} access tokens`);
};
