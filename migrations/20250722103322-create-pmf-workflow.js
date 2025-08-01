export const up = async (db) => {
  await db.collection("workflows").insertOne({
    code: "pigs-might-fly",
    pages: {
      cases: {
        details: {
          banner: {
            summary: {
              clientReference: {
                label: "Client Reference",
                ref: "$.payload.clientRef",
                type: "string",
              },
              submittedAt: {
                label: "Submitted Date",
                ref: "$.payload.submittedAt",
                type: "date",
              },
            },
          },
          tabs: {
            caseDetails: {
              title: "Application",
              sections: [
                {
                  title: "Applicant Details",
                  type: "list",
                  fields: [
                    {
                      ref: "$.payload.answers.isPigFarmer",
                      type: "boolean",
                      label: "Are you a pig farmer?",
                    },
                  ],
                },
                {
                  title: "Pig Stock Details",
                  type: "list",
                  fields: [
                    {
                      ref: "$.payload.answers.totalPigs",
                      type: "number",
                      label: "Total Pigs",
                    },
                    {
                      ref: "$.payload.answers.whitePigsCount",
                      type: "number",
                      label: "How many White pigs do you have?",
                    },
                    {
                      ref: "$.payload.answers.britishLandracePigsCount",
                      type: "number",
                      label: "How many British Landrace pigs do you have?",
                    },
                    {
                      ref: "$.payload.answers.berkshirePigsCount",
                      type: "number",
                      label: "How many Berkshire pigs do you have?",
                    },
                    {
                      ref: "$.payload.answers.otherPigsCount",
                      type: "number",
                      label: "How many Other pigs do you have?",
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
            id: "review-automated-checks",
            title: "Review Automated Checks",
            tasks: [
              {
                id: "review-application-data",
                title: "Review application data",
                type: "boolean",
              },
            ],
          },
        ],
        actions: [
          {
            id: "accept",
            label: "Accept",
          },
          {
            id: "reject",
            label: "Reject",
          },
        ],
      },
      {
        id: "assessment",
        title: "Assessment",
        taskGroups: [
          {
            id: "check-application",
            title: "Check Application",
            tasks: [
              {
                id: "check-application-and-documents",
                title: "Check application and documents",
                type: "boolean",
              },
              {
                id: "check-find-farm-and-land-payment-data",
                title: "Check on Find farm and land payment data",
                type: "boolean",
              },
              {
                id: "check-rps-dual-funding",
                title: "Check on RPS (Dual Funding)",
                type: "boolean",
              },
            ],
          },
          {
            id: "registration-checks",
            title: "Registration checks",
            tasks: [
              {
                id: "confirm-farm-has-cph",
                title: "Confirm farm has a CPH",
                type: "boolean",
              },
              {
                id: "confirm-apha-registration",
                title: "Confirm APHA registration",
                type: "boolean",
              },
            ],
          },
        ],
        actions: [
          {
            id: "confirm-approval",
            label: "Confirm Approval",
          },
          {
            id: "confirm-rejection",
            label: "Confirm Rejection",
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
  await db.collection("workflows").deleteOne({ code: "pigs-might-fly" });
};
