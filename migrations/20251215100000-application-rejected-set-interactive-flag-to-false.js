/**
 * Make APPLICATION_REJECTED interactive flags false so we can't change the status
 * of a task in the Rejected state
 *
 * PRE_AWARD:REVIEW_APPLICATION:APPLICATION_REJECTED -> interactive=false
 * PRE_AWARD:REVIEW_OFFER:APPLICATION_REJECTED -> interactive=false
 */

// Phase indexes
const PRE_AWARD = 0;

// Stage indexes for PRE_AWARD
const REVIEW_APPLICATION = 0;
const REVIEW_OFFER = 1;

// Status indexes
const APPLICATION_REJECTED_REVIEW = 3;
const APPLICATION_REJECTED_OFFER = 1;

export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.statuses.${APPLICATION_REJECTED_REVIEW}.interactive`]: false,
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.statuses.${APPLICATION_REJECTED_OFFER}.interactive`]: false,
      },
    },
  );
};
