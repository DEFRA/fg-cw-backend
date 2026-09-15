import { logger } from "../src/common/logger.js";

// Mixed or non-canonical values sort out of time order and break keyset paging.
const CANONICAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const insertedAt = { $toDate: "$_id" };

const INDEX_NOT_FOUND = 27;

// Every `eventTime` query also filters on status, which the status-led index serves.
const dropUnusedEventTimeListIndex = async (inbox) => {
  try {
    await inbox.dropIndex({ eventTime: -1, _id: -1 });
  } catch (error) {
    if (error.code !== INDEX_NOT_FOUND) {
      throw error;
    }
  }
};

export const up = async (db) => {
  const inbox = db.collection("inbox");

  // `$not` over a regex also matches nulls, non-strings and missing fields.
  const result = await inbox.updateMany(
    { publicationDate: { $not: CANONICAL_ISO } },
    [
      {
        $set: {
          publicationDate: {
            $toString: {
              $convert: {
                input: "$publicationDate",
                to: "date",
                onError: insertedAt,
                onNull: insertedAt,
              },
            },
          },
        },
      },
    ],
  );

  logger.info(
    `Normalised ${result.modifiedCount} inbox publicationDate values to ISO strings`,
  );

  await inbox.createIndex({ publicationDate: -1, _id: -1 });
  await inbox.createIndex({ status: 1, publicationDate: -1, _id: -1 });
  await dropUnusedEventTimeListIndex(inbox);
};
