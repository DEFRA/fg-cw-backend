import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  const query = { code: "frps-private-beta" };
  const withdrawRequestedTransition = {
    targetPosition: "PRE_AWARD:REVIEW_APPLICATION:WITHDRAWAL_REQUESTED",
    action: {
      code: "WITHDRAW_APPLICATION",
      name: "Withdraw",
      checkTasks: false,
      comment: {
        label: "Explain this decision",
        helpText: "You must include an explanation for auditing purposes.",
        mandatory: true,
      },
    },
    checkTasks: false,
  };

  const withdrawRequestedStatus = {
    code: "WITHDRAWAL_REQUESTED",
    name: "Withdrawal Requested",
    description: "Application withdrawal has been requested",
    interactive: false,
    transitions: [
      {
        targetPosition: "PRE_AWARD:REVIEW_APPLICATION:APPLICATION_WITHDRAWN",
        checkTasks: false,
      },
    ],
  };

  const applicationWithdrawnStatus = {
    code: "APPLICATION_WITHDRAWN",
    name: "Withdrawn",
    description: "Application has been withdrawn",
    interactive: false,
    transitions: [],
  };

  await withTransaction(async (session) => {
    const collection = db.collection("workflows");

    // add checkTasks to all transitions - default to true
    await collection.updateMany(
      query,
      [
        {
          $set: {
            phases: {
              $map: {
                input: "$phases",
                as: "phase",
                in: {
                  $mergeObjects: [
                    "$$phase",
                    {
                      stages: {
                        $map: {
                          input: "$$phase.stages",
                          as: "stage",
                          in: {
                            $mergeObjects: [
                              "$$stage",
                              {
                                statuses: {
                                  $map: {
                                    input: "$$stage.statuses",
                                    as: "status",
                                    in: {
                                      $mergeObjects: [
                                        "$$status",
                                        {
                                          transitions: {
                                            $map: {
                                              input: "$$status.transitions",
                                              as: "transition",
                                              in: {
                                                $mergeObjects: [
                                                  "$$transition",
                                                  { checkTasks: true },
                                                ],
                                              },
                                            },
                                          },
                                        },
                                      ],
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
      { session },
    );

    // PRE_AWARD:REVIEW_APPLICATION
    // :IN_REVIEW
    await collection.updateOne(
      query,
      {
        $push: {
          "phases.$[phase].stages.$[stage].statuses": {
            $each: [withdrawRequestedStatus, applicationWithdrawnStatus],
          },
        },
      },
      {
        arrayFilters: [
          { "phase.code": "PRE_AWARD" },
          { "stage.code": "REVIEW_APPLICATION" },
        ],
        session,
      },
    );

    // PRE_AWARD:REVIEW_APPLICATION
    // :IN_REVIEW & :AGREEMENT_GENERATING
    await collection.updateOne(
      query,
      {
        $push: {
          "phases.$[phase].stages.$[stage].statuses.$[status].transitions":
            withdrawRequestedTransition,
        },
      },
      {
        arrayFilters: [
          { "phase.code": "PRE_AWARD" },
          { "stage.code": "REVIEW_APPLICATION" },
          { "status.code": { $in: ["IN_REVIEW", "AGREEMENT_GENERATING"] } },
        ],
        session,
      },
    );

    // PRE_AWARD:REVIEW_OFFER
    // :AGREEMENT_DRAFTED
    await collection.updateOne(
      query,
      {
        $push: {
          "phases.$[phase].stages.$[stage].statuses.$[status].transitions":
            withdrawRequestedTransition,
        },
      },
      {
        arrayFilters: [
          { "phase.code": "PRE_AWARD" },
          { "stage.code": "REVIEW_OFFER" },
          { "status.code": "AGREEMENT_DRAFTED" },
        ],
        session,
      },
    );

    // PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW
    // :AGREEMENT_OFFERED
    await collection.updateOne(
      query,
      {
        $push: {
          "phases.$[phase].stages.$[stage].statuses.$[status].transitions":
            withdrawRequestedTransition,
        },
      },
      {
        arrayFilters: [
          { "phase.code": "PRE_AWARD" },
          { "stage.code": "CUSTOMER_AGREEMENT_REVIEW" },
          { "status.code": "AGREEMENT_OFFERED" },
        ],
        session,
      },
    );
  });
};
