export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "methane" },
    {
      $set: {
        code: "methane",
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "[Business name placeholder]",
                  type: "string",
                },
              },
              tabs: {
                "case-details": {
                  content: [
                    {
                      title: "Application details",
                      type: "object",
                      component: "summary-list",
                      rows: [
                        {
                          text: "$.payload.answers.isDiaryFarmer",
                          type: "boolean",
                          label: "Are you a diary farmer?",
                          format: "yesNo",
                        },
                        {
                          text: "$.payload.answers.isDiaryKeptInEngland",
                          type: "boolean",
                          label: "Are the diary cows kept in England?",
                          format: "yesNo",
                        },
                        {
                          text: "$.payload.answers.isDiaryHerdForYear",
                          type: "boolean",
                          label:
                            "Do you house your dairy herd for at least some of the year?",
                          format: "yesNo",
                        },
                        {
                          text: "$.payload.answers.feedTMR",
                          type: "boolean",
                          label:
                            "Do you feed your dairy cows a total mixed ration (TMR) when housed?",
                          format: "yesNo",
                        },
                        {
                          text: "$.payload.answers.diaryCowsFedCount",
                          type: "number",
                          label: "Number of diary cows fed",
                        },
                        {
                          text: "$.payload.answers.monthsDiaryCowHoused",
                          type: "number",
                          label: "Number of months diary cows are housed",
                        },
                        {
                          text: "$.payload.answers.msfpOptions",
                          type: "string",
                          label: "MSFP",
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        stages: [
          {
            code: "application-received",
            name: "Application Received",
            description: null,
            statuses: [],
            taskGroups: [
              {
                code: "review-application-details",
                name: "Review Application Details",
                description: null,
                tasks: [
                  {
                    code: "cts-dairy-cow-review",
                    name: "CTS dairy cow review",
                    description: null,
                    type: "boolean",
                    statusOptions: [],
                  },
                  {
                    code: "spotlight-financial-check",
                    name: "Spotlight financial check",
                    description: null,
                    type: "boolean",
                    statusOptions: [],
                  },
                ],
              },
            ],
            actionsTitle: "Decision",
            actions: [
              {
                code: "approve",
                name: "Recommend for approval",
                comment: {
                  label: "Note",
                  helpText: "All notes will be saved for auditing purposes",
                  type: "REQUIRED",
                },
              },
              {
                code: "on-hold",
                name: "Put on hold",
                comment: {
                  label: "Note (optional)",
                  helpText: "All notes will be saved for auditing purposes",
                  type: "OPTIONAL",
                },
              },
              {
                code: "recommend-for-rejection",
                name: "Recommend for rejection",
                comment: {
                  label: "Reason for rejection",
                  helpText: "All notes will be saved for auditing purposes",
                  type: "REQUIRED",
                },
              },
            ],
          },
          {
            code: "assessment",
            name: "Make application decision",
            description: null,
            statuses: [],
            taskGroups: [
              {
                code: "make-casework-decision",
                name: "Make casework decision",
                description: null,
                tasks: [
                  {
                    code: "confirm-casework-decision",
                    name: "Confirm casework decision",
                    description: null,
                    type: "boolean",
                    statusOptions: [],
                  },
                ],
              },
            ],
            actionsTitle: "Decision",
            actions: [
              {
                code: "approve",
                name: "Approve",
                comment: {
                  label: "Note",
                  helpText: "All notes will be saved for auditing purposes",
                  type: "REQUIRED",
                },
              },
              {
                code: "put-on-hold",
                name: "Put on hold",
                comment: {
                  label: "Note",
                  helpText: "All notes will be saved for auditing purposes",
                  type: "OPTIONAL",
                },
              },
              {
                code: "reject",
                name: "Reject",
                comment: {
                  label: "Reason for rejection",
                  helpText: "All notes will be saved for auditing purposes",
                  type: "REQUIRED",
                },
              },
            ],
          },
          {
            code: "contracted",
            name: "Contracted",
            description: null,
            statuses: [],
            taskGroups: [],
            actions: [],
          },
        ],
        requiredRoles: {
          allOf: ["ROLE_RPA_ADMIN"],
          anyOf: ["ROLE_RPA_ADMIN"],
        },
      },
    },
    { upsert: true },
  );
};

export const down = async (db) => {
  await db.collection("workflows").deleteOne({ code: "methane" });
};
