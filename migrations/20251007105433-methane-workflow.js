export const up = async (db) => {
  await db.collection("workflows").insertOne({
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
        id: "application-received",
        title: "Application Received",
        taskGroups: [
          {
            id: "review-application-details",
            title: "Review Application Details",
            tasks: [
              {
                id: "cts-dairy-cow-review",
                title: "CTS dairy cow review",
                type: "boolean",
              },
              {
                id: "spotlight-financial-check",
                title: "Spotlight financial check",
                type: "boolean",
              },
            ],
          },
        ],
        actionsTitle: "Decision",
        actions: [
          {
            id: "approve",
            label: "Recommend for approval",
            comment: {
              label: "Note",
              helpText: "All notes will be saved for auditing purposes",
              type: "REQUIRED",
            },
          },
          {
            id: "on-hold",
            label: "Put on hold",
            comment: {
              label: "Note (optional)",
              helpText: "All notes will be saved for auditing purposes",
              type: "OPTIONAL",
            },
          },
          {
            id: "recommend-for-rejection",
            label: "Recommend for rejection",
            comment: {
              label: "Reason for rejection",
              helpText: "All notes will be saved for auditing purposes",
              type: "REQUIRED",
            },
          },
        ],
      },
      {
        id: "assessment",
        title: "Make application decision",
        taskGroups: [
          {
            id: "make-casework-decision",
            title: "Make casework decision",
            tasks: [
              {
                id: "confirm-casework-decision",
                title: "Confirm casework decision",
                type: "boolean",
              },
            ],
          },
        ],
        actionsTitle: "Decision",
        actions: [
          {
            id: "approve",
            label: "Approve",
            comment: {
              label: "Note",
              helpText: "All notes will be saved for auditing purposes",
              type: "REQUIRED",
            },
          },
          {
            id: "put-on-hold",
            label: "Put on hold",
            comment: {
              label: "Note",
              helpText: "All notes will be saved for auditing purposes",
              type: "OPTIONAL",
            },
          },
          {
            id: "reject",
            label: "Reject",
            comment: {
              label: "Reason for rejection",
              helpText: "All notes will be saved for auditing purposes",
              type: "REQUIRED",
            },
          },
        ],
      },
      {
        id: "contracted",
        title: "Contracted",
        taskGroups: [],
        actions: [],
      },
    ],
    requiredRoles: {
      allOf: ["ROLE_RPA_ADMIN"],
      anyOf: ["ROLE_RPA_ADMIN"],
    },
  });
};

export const down = async (db) => {
  await db.collection("workflows").deleteOne({ code: "methane" });
};
