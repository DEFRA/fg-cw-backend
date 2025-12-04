import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  const query = { code: "frps-private-beta" };
  const withdrawRequestedTransition = {
    targetPosition: "PRE_AWARD:REVIEW_APPLICATION:WITHDRAW_REQUESTED",
    action: {
      code: "WITHDRAW_REQUESTED",
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
    code: "WITHDRAW_REQUESTED",
    name: "Withdraw Requested",
    description: "Application withdraw has been requested",
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
    transitions: [
      {
        targetPosition: "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
        action: {
          code: "REINSTATE_APPLICATION",
          name: "Reinstate Application",
          checkTasks: false,
          comment: {
            label: "Explain this decision",
            helpText: "You must include an explanation for auditing purposes.",
            mandatory: true,
          },
        },
        checkTasks: false,
      },
    ],
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
          { "status.code": "IN_REVIEW" },
        ],
        session,
      },
    );

    // :AGREEMENT_GENERATING
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
          { "status.code": "AGREEMENT_GENERATING" },
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

export const down = async (db) => {
  const query = { code: "frps-private-beta" };
  const collection = db.collection("workflows");
  await withTransaction(async (session) => {
    await collection.updateMany(
      query,
      {
        $unset: {
          "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition].checkTasks":
            "",
        },
      },
      {
        arrayFilters: [
          { phase: { $exists: true } },
          { stage: { $exists: true } },
          { status: { $exists: true } },
          { "transition.checkTasks": { $exists: true } },
        ],
        session,
      },
    );

    // PRE_AWARD:REVIEW_APPLICATION
    // :IN_REVIEW
    await collection.updateOne(
      query,
      {
        $unset: {
          "phases.$[phase].stages.$[stage].statuses.$[status]": "",
        },
      },
      {
        arrayFilters: [
          { "phase.code": "PRE_AWARD" },
          { "stage.code": "REVIEW_APPLICATION" },
          {
            "status.code": {
              $in: ["APPLICATION_WITHDRAWN", "WITHDRAW_REQUESTED"],
            },
          },
        ],
        session,
      },
    );

    await collection.updateOne(
      query,
      {
        $unset: {
          "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition]":
            "",
        },
      },
      {
        arrayFilters: [
          { "phase.code": "PRE_AWARD" },
          { "stage.code": "REVIEW_APPLICATION" },
          { "status.code": "IN_REVIEW" },
          {
            "transition.targetPosition":
              "PRE_AWARD:REVIEW_APPLICATION:WITHDRAW_REQUESTED",
          },
        ],
        session,
      },
    );

    // :AGREEMENT_GENERATING
    await collection.updateOne(
      query,
      {
        $unset: {
          "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition]":
            "",
        },
      },
      {
        arrayFilters: [
          { "phase.code": "PRE_AWARD" },
          { "stage.code": "REVIEW_APPLICATION" },
          { "status.code": "AGREEMENT_GENERATING" },
          {
            "transition.targetPosition":
              "PRE_AWARD:REVIEW_APPLICATION:WITHDRAW_REQUESTED",
          },
        ],
        session,
      },
    );

    // PRE_AWARD:REVIEW_OFFER
    // :AGREEMENT_DRAFTED
    await collection.updateOne(
      query,
      {
        $unset: {
          "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition]":
            "",
        },
      },
      {
        arrayFilters: [
          { "phase.code": "PRE_AWARD" },
          { "stage.code": "REVIEW_OFFER" },
          { "status.code": "AGREEMENT_DRAFTED" },
          {
            "transition.targetPosition":
              "PRE_AWARD:REVIEW_APPLICATION:WITHDRAW_REQUESTED",
          },
        ],
        session,
      },
    );

    // PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW
    // :AGREEMENT_OFFERED
    await collection.updateOne(
      query,
      {
        $unset: {
          "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition]":
            "",
        },
      },
      {
        arrayFilters: [
          { "phase.code": "PRE_AWARD" },
          { "stage.code": "CUSTOMER_AGREEMENT_REVIEW" },
          { "status.code": "AGREEMENT_OFFERED" },
          {
            "transition.targetPosition":
              "PRE_AWARD:REVIEW_APPLICATION:WITHDRAW_REQUESTED",
          },
        ],
        session,
      },
    );
  });
};
