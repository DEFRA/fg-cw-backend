/**
 * Migration: Add status themes to FRPS workflow and update status names
 *
 * This migration adds the 'theme' attribute to all statuses in the FRPS workflow
 * and updates status names for AGREEMENT_DRAFTED and AGREEMENT_OFFERED.
 *
 * Changes:
 * - Add theme attribute to all statuses (NEUTRAL, INFO, WARN, ERROR, SUCCESS)
 * - Update AGREEMENT_DRAFTED name from "Review Offer" to "Agreement drafted"
 * - Update AGREEMENT_OFFERED name from "Agreement Offer Made" to "Agreement offered"
 */

// Shared constants for workflow structure
const WORKFLOW_CODE = "frps-private-beta";

// Phase indexes
const PRE_AWARD = 0;
const POST_AGREEMENT_MONITORING = 1;

// Stage indexes for PRE_AWARD
const REVIEW_APPLICATION = 0;
const REVIEW_OFFER = 1;
const CUSTOMER_AGREEMENT_REVIEW = 2;

// Stage indexes for POST_AGREEMENT_MONITORING
const MONITORING = 0;

// Status indexes for REVIEW_APPLICATION stage
const APPLICATION_RECEIVED = 0;
const IN_REVIEW = 1;
const AGREEMENT_GENERATING = 2;
const APPLICATION_REJECTED_REVIEW = 3;
const ON_HOLD = 4;

// Status indexes for REVIEW_OFFER stage
const AGREEMENT_DRAFTED = 0;
const APPLICATION_REJECTED_OFFER = 1;

// Status indexes for CUSTOMER_AGREEMENT_REVIEW stage
const AGREEMENT_OFFERED = 0;

// Status indexes for MONITORING stage
const AGREEMENT_ACCEPTED = 0;

export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $set: {
        // PRE_AWARD > REVIEW_APPLICATION stage statuses
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.statuses.${APPLICATION_RECEIVED}.theme`]:
          "NEUTRAL",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.statuses.${IN_REVIEW}.theme`]:
          "INFO",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.statuses.${AGREEMENT_GENERATING}.theme`]:
          "NEUTRAL",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.statuses.${APPLICATION_REJECTED_REVIEW}.theme`]:
          "ERROR",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.statuses.${ON_HOLD}.theme`]:
          "WARN",

        // PRE_AWARD > REVIEW_OFFER stage statuses
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.statuses.${AGREEMENT_DRAFTED}.theme`]:
          "INFO",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.statuses.${AGREEMENT_DRAFTED}.name`]:
          "Agreement drafted",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.statuses.${APPLICATION_REJECTED_OFFER}.theme`]:
          "ERROR",

        // PRE_AWARD > CUSTOMER_AGREEMENT_REVIEW stage statuses
        [`phases.${PRE_AWARD}.stages.${CUSTOMER_AGREEMENT_REVIEW}.statuses.${AGREEMENT_OFFERED}.theme`]:
          "INFO",
        [`phases.${PRE_AWARD}.stages.${CUSTOMER_AGREEMENT_REVIEW}.statuses.${AGREEMENT_OFFERED}.name`]:
          "Agreement offered",

        // POST_AGREEMENT_MONITORING > MONITORING stage statuses
        [`phases.${POST_AGREEMENT_MONITORING}.stages.${MONITORING}.statuses.${AGREEMENT_ACCEPTED}.theme`]:
          "SUCCESS",
      },
    },
  );
};
