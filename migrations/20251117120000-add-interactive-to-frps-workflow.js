export const up = async (db) => {
  // Update the frps-private-beta workflow to add interactive property to all statuses
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        // PRE_AWARD phase - REVIEW_APPLICATION stage statuses
        "phases.0.stages.0.statuses.0.interactive": false, // APPLICATION_RECEIVED
        "phases.0.stages.0.statuses.1.interactive": true, // IN_REVIEW
        "phases.0.stages.0.statuses.2.interactive": true, // AGREEMENT_GENERATING
        "phases.0.stages.0.statuses.3.interactive": true, // APPLICATION_REJECTED
        "phases.0.stages.0.statuses.4.interactive": true, // PUT_ON_HOLD

        // PRE_AWARD phase - REVIEW_OFFER stage statuses
        "phases.0.stages.1.statuses.0.interactive": true, // AGREEMENT_DRAFTED
        "phases.0.stages.1.statuses.1.interactive": true, // APPLICATION_REJECTED

        // PRE_AWARD phase - CUSTOMER_AGREEMENT_REVIEW stage statuses
        "phases.0.stages.2.statuses.0.interactive": true, // AGREEMENT_OFFERED
        "phases.0.stages.2.statuses.1.interactive": true, // APPLICATION_REJECTED

        // POST_AGREEMENT_MONITORING phase - MONITORING stage statuses
        "phases.1.stages.0.statuses.0.interactive": true, // AGREEMENT_ACCEPTED
        "phases.1.stages.0.statuses.1.interactive": false, // COMPLETE_AGREEMENT
      },
    },
  );

  console.log(
    "Successfully added interactive property to frps-private-beta workflow statuses",
  );
};

export const down = async (db) => {
  // Remove the interactive property from all statuses
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $unset: {
        // PRE_AWARD phase - REVIEW_APPLICATION stage statuses
        "phases.0.stages.0.statuses.0.interactive": "",
        "phases.0.stages.0.statuses.1.interactive": "",
        "phases.0.stages.0.statuses.2.interactive": "",
        "phases.0.stages.0.statuses.3.interactive": "",
        "phases.0.stages.0.statuses.4.interactive": "",

        // PRE_AWARD phase - REVIEW_OFFER stage statuses
        "phases.0.stages.1.statuses.0.interactive": "",
        "phases.0.stages.1.statuses.1.interactive": "",

        // PRE_AWARD phase - CUSTOMER_AGREEMENT_REVIEW stage statuses
        "phases.0.stages.2.statuses.0.interactive": "",
        "phases.0.stages.2.statuses.1.interactive": "",

        // POST_AGREEMENT_MONITORING phase - MONITORING stage statuses
        "phases.1.stages.0.statuses.0.interactive": "",
        "phases.1.stages.0.statuses.1.interactive": "",
      },
    },
  );

  console.log(
    "Successfully removed interactive property from frps-private-beta workflow statuses",
  );
};
