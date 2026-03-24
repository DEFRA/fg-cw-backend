/**
 * Migration: Add themes to FRPS task statusOptions
 *
 * This migration adds the 'theme' attribute to all task statusOptions in the FRPS workflow.
 * This is required by the WorkflowTaskStatusOption schema validation.
 *
 * Theme mappings:
 * - ACCEPTED: SUCCESS (completing action)
 * - RFI: INFO (requesting information)
 * - INTERNAL_INVESTIGATION: WARN (paused/warning state)
 * - CANNOT_COMPLETE: ERROR (failure state)
 * - CONFIRM: SUCCESS (completing action)
 * - PROBLEM_FOUND: ERROR (problem/issue state)
 */

const WORKFLOW_CODE = "frps-private-beta";

export const up = async (db) => {
  // Task 0: CHECK_CUSTOMER_DETAILS
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $set: {
        "phases.0.stages.0.taskGroups.0.tasks.0.statusOptions.0.theme":
          "SUCCESS",
        "phases.0.stages.0.taskGroups.0.tasks.0.statusOptions.1.theme": "INFO",
        "phases.0.stages.0.taskGroups.0.tasks.0.statusOptions.2.theme": "WARN",
        "phases.0.stages.0.taskGroups.0.tasks.0.statusOptions.3.theme": "ERROR",
      },
    },
  );

  // Task 1: REVIEW_LAND_RULES
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $set: {
        "phases.0.stages.0.taskGroups.0.tasks.1.statusOptions.0.theme":
          "SUCCESS",
        "phases.0.stages.0.taskGroups.0.tasks.1.statusOptions.1.theme": "INFO",
        "phases.0.stages.0.taskGroups.0.tasks.1.statusOptions.2.theme": "WARN",
        "phases.0.stages.0.taskGroups.0.tasks.1.statusOptions.3.theme": "ERROR",
      },
    },
  );

  // Task 2: SSSI_CONSENT_REQUESTED
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $set: {
        "phases.0.stages.0.taskGroups.0.tasks.2.statusOptions.0.theme":
          "SUCCESS",
        "phases.0.stages.0.taskGroups.0.tasks.2.statusOptions.1.theme": "INFO",
        "phases.0.stages.0.taskGroups.0.tasks.2.statusOptions.2.theme": "WARN",
        "phases.0.stages.0.taskGroups.0.tasks.2.statusOptions.3.theme": "ERROR",
      },
    },
  );

  // Task 3: PAYMENT_AMOUNT_CHECK
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $set: {
        "phases.0.stages.0.taskGroups.0.tasks.3.statusOptions.0.theme":
          "SUCCESS",
        "phases.0.stages.0.taskGroups.0.tasks.3.statusOptions.1.theme": "INFO",
        "phases.0.stages.0.taskGroups.0.tasks.3.statusOptions.2.theme": "WARN",
        "phases.0.stages.0.taskGroups.0.tasks.3.statusOptions.3.theme": "ERROR",
      },
    },
  );

  // Task 4: REVIEW_SCHEME_BUDGET
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $set: {
        "phases.0.stages.0.taskGroups.0.tasks.4.statusOptions.0.theme":
          "SUCCESS",
        "phases.0.stages.0.taskGroups.0.tasks.4.statusOptions.1.theme": "INFO",
        "phases.0.stages.0.taskGroups.0.tasks.4.statusOptions.2.theme": "WARN",
        "phases.0.stages.0.taskGroups.0.tasks.4.statusOptions.3.theme": "ERROR",
      },
    },
  );

  // Task 5: REVIEW_OFFER_DOCUMENT
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $set: {
        "phases.0.stages.1.taskGroups.0.tasks.0.statusOptions.0.theme":
          "SUCCESS",
        "phases.0.stages.1.taskGroups.0.tasks.0.statusOptions.1.theme": "ERROR",
      },
    },
  );

  // Task 6: OFFER_AGREEMENT
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $set: {
        "phases.0.stages.1.taskGroups.0.tasks.1.statusOptions.0.theme":
          "SUCCESS",
        "phases.0.stages.1.taskGroups.0.tasks.1.statusOptions.1.theme": "ERROR",
      },
    },
  );
};

export const down = async (db) => {
  // Remove themes from all task statusOptions
  await db.collection("workflows").updateOne(
    { code: WORKFLOW_CODE },
    {
      $unset: {
        // Task 0: CHECK_CUSTOMER_DETAILS
        "phases.0.stages.0.taskGroups.0.tasks.0.statusOptions.0.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.0.statusOptions.1.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.0.statusOptions.2.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.0.statusOptions.3.theme": "",
        // Task 1: REVIEW_LAND_RULES
        "phases.0.stages.0.taskGroups.0.tasks.1.statusOptions.0.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.1.statusOptions.1.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.1.statusOptions.2.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.1.statusOptions.3.theme": "",
        // Task 2: SSSI_CONSENT_REQUESTED
        "phases.0.stages.0.taskGroups.0.tasks.2.statusOptions.0.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.2.statusOptions.1.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.2.statusOptions.2.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.2.statusOptions.3.theme": "",
        // Task 3: PAYMENT_AMOUNT_CHECK
        "phases.0.stages.0.taskGroups.0.tasks.3.statusOptions.0.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.3.statusOptions.1.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.3.statusOptions.2.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.3.statusOptions.3.theme": "",
        // Task 4: REVIEW_SCHEME_BUDGET
        "phases.0.stages.0.taskGroups.0.tasks.4.statusOptions.0.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.4.statusOptions.1.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.4.statusOptions.2.theme": "",
        "phases.0.stages.0.taskGroups.0.tasks.4.statusOptions.3.theme": "",
        // Task 5: REVIEW_OFFER_DOCUMENT
        "phases.0.stages.1.taskGroups.0.tasks.0.statusOptions.0.theme": "",
        "phases.0.stages.1.taskGroups.0.tasks.0.statusOptions.1.theme": "",
        // Task 6: OFFER_AGREEMENT
        "phases.0.stages.1.taskGroups.0.tasks.1.statusOptions.0.theme": "",
        "phases.0.stages.1.taskGroups.0.tasks.1.statusOptions.1.theme": "",
      },
    },
  );
};
