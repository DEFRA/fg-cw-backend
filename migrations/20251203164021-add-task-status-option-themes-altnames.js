/**
 * Migration: Add theme and altName to task status options in FRPS workflow
 *
 * This migration adds 'theme' and 'altName' attributes to task status options
 * in the FRPS workflow to enable better visual presentation and user guidance.
 *
 * Changes:
 * - Add theme attribute to all task status options (NONE, NOTICE, ERROR)
 * - Add altName attribute to provide alternative text for status option selection
 * - Update name field to reflect the display text for completed tasks
 */

// Shared constants for workflow structure
const WORKFLOW_CODE = "frps-private-beta";

// Phase indexes
const PRE_AWARD = 0;

// Stage indexes for PRE_AWARD
const REVIEW_APPLICATION = 0;
const REVIEW_OFFER = 1;

// TaskGroup indexes
const MANUAL_REVIEW_TASKS = 0; // In REVIEW_APPLICATION
const DRAFT_AGREEMENT_REVIEW_TASKS = 0; // In REVIEW_OFFER

// Task indexes in REVIEW_APPLICATION > MANUAL_REVIEW_TASKS
const CHECK_CUSTOMER_DETAILS = 0;
const REVIEW_LAND_RULES = 1;
const SSSI_CONSENT_REQUESTED = 2;
const PAYMENT_AMOUNT_CHECK = 3;
const REVIEW_SCHEME_BUDGET = 4;

// Task indexes in REVIEW_OFFER > DRAFT_AGREEMENT_REVIEW_TASKS
const REVIEW_OFFER_DOCUMENT = 0;
const OFFER_AGREEMENT = 1;

// Status option indexes (consistent across REVIEW_APPLICATION tasks)
const ACCEPTED = 0;
const RFI = 1;
const INTERNAL_INVESTIGATION = 2;
const CANNOT_COMPLETE = 3;

// Status option indexes for REVIEW_OFFER tasks
const CONFIRM = 0;
const PROBLEM_FOUND = 1;

export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $set: {
        // ========================================
        // REVIEW_APPLICATION > CHECK_CUSTOMER_DETAILS task
        // ========================================
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${ACCEPTED}.name`]:
          "Accepted",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${ACCEPTED}.theme`]:
          "NONE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${ACCEPTED}.altName`]:
          "Accept",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${RFI}.name`]:
          "Information requested",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${RFI}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${RFI}.altName`]:
          "Request information from customer",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${INTERNAL_INVESTIGATION}.name`]:
          "Internal investigation",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${INTERNAL_INVESTIGATION}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${INTERNAL_INVESTIGATION}.altName`]:
          "Pause for internal investigation",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${CANNOT_COMPLETE}.name`]:
          "Cannot complete",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${CANNOT_COMPLETE}.theme`]:
          "ERROR",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${CHECK_CUSTOMER_DETAILS}.statusOptions.${CANNOT_COMPLETE}.altName`]:
          "Cannot complete",

        // ========================================
        // REVIEW_APPLICATION > REVIEW_LAND_RULES task
        // ========================================
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${ACCEPTED}.name`]:
          "Accepted",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${ACCEPTED}.theme`]:
          "NONE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${ACCEPTED}.altName`]:
          "Accept",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${RFI}.name`]:
          "Information requested",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${RFI}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${RFI}.altName`]:
          "Request information from customer",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${INTERNAL_INVESTIGATION}.name`]:
          "Internal investigation",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${INTERNAL_INVESTIGATION}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${INTERNAL_INVESTIGATION}.altName`]:
          "Pause for internal investigation",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${CANNOT_COMPLETE}.name`]:
          "Cannot complete",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${CANNOT_COMPLETE}.theme`]:
          "ERROR",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_LAND_RULES}.statusOptions.${CANNOT_COMPLETE}.altName`]:
          "Cannot complete",

        // ========================================
        // REVIEW_APPLICATION > SSSI_CONSENT_REQUESTED task
        // ========================================
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${ACCEPTED}.name`]:
          "Accepted",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${ACCEPTED}.theme`]:
          "NONE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${ACCEPTED}.altName`]:
          "Accept",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${RFI}.name`]:
          "Information requested",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${RFI}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${RFI}.altName`]:
          "Request information from customer",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${INTERNAL_INVESTIGATION}.name`]:
          "Internal investigation",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${INTERNAL_INVESTIGATION}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${INTERNAL_INVESTIGATION}.altName`]:
          "Pause for internal investigation",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${CANNOT_COMPLETE}.name`]:
          "Cannot complete",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${CANNOT_COMPLETE}.theme`]:
          "ERROR",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${SSSI_CONSENT_REQUESTED}.statusOptions.${CANNOT_COMPLETE}.altName`]:
          "Cannot complete",

        // ========================================
        // REVIEW_APPLICATION > PAYMENT_AMOUNT_CHECK task
        // ========================================
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${ACCEPTED}.name`]:
          "Accepted",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${ACCEPTED}.theme`]:
          "NONE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${ACCEPTED}.altName`]:
          "Accept",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${RFI}.name`]:
          "Information requested",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${RFI}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${RFI}.altName`]:
          "Request information from customer",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${INTERNAL_INVESTIGATION}.name`]:
          "Internal investigation",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${INTERNAL_INVESTIGATION}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${INTERNAL_INVESTIGATION}.altName`]:
          "Pause for internal investigation",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${CANNOT_COMPLETE}.name`]:
          "Cannot complete",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${CANNOT_COMPLETE}.theme`]:
          "ERROR",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${PAYMENT_AMOUNT_CHECK}.statusOptions.${CANNOT_COMPLETE}.altName`]:
          "Cannot complete",

        // ========================================
        // REVIEW_APPLICATION > REVIEW_SCHEME_BUDGET task
        // ========================================
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${ACCEPTED}.name`]:
          "Accepted",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${ACCEPTED}.theme`]:
          "NONE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${ACCEPTED}.altName`]:
          "Accept",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${RFI}.name`]:
          "Information requested",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${RFI}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${RFI}.altName`]:
          "Request information from customer",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${INTERNAL_INVESTIGATION}.name`]:
          "Internal investigation",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${INTERNAL_INVESTIGATION}.theme`]:
          "NOTICE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${INTERNAL_INVESTIGATION}.altName`]:
          "Pause for internal investigation",

        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${CANNOT_COMPLETE}.name`]:
          "Cannot complete",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${CANNOT_COMPLETE}.theme`]:
          "ERROR",
        [`phases.${PRE_AWARD}.stages.${REVIEW_APPLICATION}.taskGroups.${MANUAL_REVIEW_TASKS}.tasks.${REVIEW_SCHEME_BUDGET}.statusOptions.${CANNOT_COMPLETE}.altName`]:
          "Cannot complete",

        // ========================================
        // REVIEW_OFFER > REVIEW_OFFER_DOCUMENT task
        // ========================================
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${REVIEW_OFFER_DOCUMENT}.statusOptions.${CONFIRM}.name`]:
          "Confirmed",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${REVIEW_OFFER_DOCUMENT}.statusOptions.${CONFIRM}.theme`]:
          "NONE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${REVIEW_OFFER_DOCUMENT}.statusOptions.${CONFIRM}.altName`]:
          "Confirm",

        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${REVIEW_OFFER_DOCUMENT}.statusOptions.${PROBLEM_FOUND}.name`]:
          "There's a problem",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${REVIEW_OFFER_DOCUMENT}.statusOptions.${PROBLEM_FOUND}.theme`]:
          "ERROR",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${REVIEW_OFFER_DOCUMENT}.statusOptions.${PROBLEM_FOUND}.altName`]:
          "There's a problem",

        // ========================================
        // REVIEW_OFFER > OFFER_AGREEMENT task
        // ========================================
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${OFFER_AGREEMENT}.statusOptions.${CONFIRM}.name`]:
          "Confirmed",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${OFFER_AGREEMENT}.statusOptions.${CONFIRM}.theme`]:
          "NONE",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${OFFER_AGREEMENT}.statusOptions.${CONFIRM}.altName`]:
          "Confirm",

        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${OFFER_AGREEMENT}.statusOptions.${PROBLEM_FOUND}.name`]:
          "There's a problem",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${OFFER_AGREEMENT}.statusOptions.${PROBLEM_FOUND}.theme`]:
          "ERROR",
        [`phases.${PRE_AWARD}.stages.${REVIEW_OFFER}.taskGroups.${DRAFT_AGREEMENT_REVIEW_TASKS}.tasks.${OFFER_AGREEMENT}.statusOptions.${PROBLEM_FOUND}.altName`]:
          "There's a problem",
      },
    },
  );
};
