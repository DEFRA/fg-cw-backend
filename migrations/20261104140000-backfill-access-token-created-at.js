import { logger } from "../src/common/logger.js";

// Rows the old seeder rotated in place kept their _id, so they get the date they were first seeded.
const lacksCreatedAt = { createdAt: { $exists: false } };

export const up = async (db) => {
  const accessTokens = db.collection("access_tokens");

  const { modifiedCount } = await accessTokens.updateMany(lacksCreatedAt, [
    { $set: { createdAt: { $toDate: "$_id" } } },
  ]);

  logger.info(`Backfilled createdAt on ${modifiedCount} access tokens`);
};
