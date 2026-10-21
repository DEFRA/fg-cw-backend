import { logger } from "../src/common/logger.js";

// Mixed types in a sort key are type-bracketed in Mongo, so paging the case
// list newest first would misplace them. Cases write createdAt as a Date;
// anything else becomes the Date of its own instant, or of the insert time
// where it has none.

const insertedAt = { $toDate: "$_id" };

export const up = async (db) => {
  // `$not` over `$type` also matches missing fields.
  const result = await db
    .collection("cases")
    .updateMany({ createdAt: { $not: { $type: "date" } } }, [
      {
        $set: {
          createdAt: {
            $convert: {
              input: "$createdAt",
              to: "date",
              onError: insertedAt,
              onNull: insertedAt,
            },
          },
        },
      },
    ]);

  logger.info(
    `Normalised ${result.modifiedCount} case createdAt values to Dates`,
  );
};
