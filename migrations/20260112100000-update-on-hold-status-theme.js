/*:
 * - Update ON_HOLD status theme from "WARN" to "NOTICE"
 */

export const up = async (db) => {
  const query = { code: "frps-private-beta" };

  // Phase indexes
  const PRE_AWARD = 0;

  // Stage indexes for PRE_AWARD
  const REVIEW_APPLICATION = 0;

  // Status indexes for REVIEW_APPLICATION stage
  const ON_HOLD = 4;

  await db.collection("workflows").updateOne(query, {
    $set: {
      [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.statuses.${ON_HOLD}.theme`]:
        "NOTICE",
    },
  });
};
