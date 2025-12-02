const query = { code: "frps-private-beta" };

export const up = async (db) => {
  const withdrawRequestedTransition = {
    targetPosition: "PRE_AWARD:REVIEW_APPLICATION:WITHDRAW_REQUESTED",
    action: {
      code: "WITHDRAW_REQUESTED",
      name: "Withdraw",
      checkTasks: false,
      comment: {
        label: "Note",
        helpText: "All notes will be saved for auditing purposes",
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
            label: "Note",
            helpText: "All notes will be saved for auditing purposes",
            mandatory: true,
          },
        },
        checkTasks: false,
      },
    ],
  };

  const collection = db.collection("workflows");

  // add checkTasks to all transitions - default to true
  collection.updateMany(query, [
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
  ]);

  // add additional statuses and transitions and turn off checking tasks for application withdrawal
  // PRE_AWARD:REVIEW_APPLICATION
  // :IN_REVIEW
  collection.updateOne(
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
    },
  );

  collection.updateOne(
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
    },
  );

  collection.updateOne(
    query,
    {
      $set: {
        "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition].checkTasks": false,
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
    },
  );

  // :WITHDRAW_REQUESTED
  collection.updateOne(
    query,
    {
      $set: {
        "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition].checkTasks": false,
      },
    },
    {
      arrayFilters: [
        { "phase.code": "PRE_AWARD" },
        { "stage.code": "REVIEW_APPLICATION" },
        { "status.code": "WITHDRAW_REQUESTED" },
        {
          "transition.targetPosition":
            "PRE_AWARD:REVIEW_APPLICATION:APPLICATION_WITHDRAWN",
        },
      ],
    },
  );
  // :APPLICATION_WITHDRAWN
  collection.updateOne(
    query,
    {
      $set: {
        "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition].checkTasks": false,
      },
    },
    {
      arrayFilters: [
        { "phase.code": "PRE_AWARD" },
        { "stage.code": "REVIEW_APPLICATION" },
        { "status.code": "APPLICATION_WITHDRAWN" },
        {
          "transition.targetPosition": "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
        },
      ],
    },
  );

  // PRE_AWARD:REVIEW_OFFER
  // :AGREEMENT_DRAFTED
  collection.updateOne(
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
    },
  );
  collection.updateOne(
    query,
    {
      $set: {
        "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition].checkTasks": false,
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
    },
  );

  // PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW
  // :AGREEMENT_OFFERED
  collection.updateOne(
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
    },
  );
  collection.updateOne(
    query,
    {
      $set: {
        "phases.$[phase].stages.$[stage].statuses.$[status].transitions.$[transition].checkTasks": false,
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
    },
  );
};

export const down = (db) => {
  const collection = db.collection("workflows");

  collection.updateMany(
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
    },
  );
};
