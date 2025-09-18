export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        // Replace the entire pages object with the new definition
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                  type: "string",
                },
                summary: {
                  reference: {
                    label: "Reference",
                    text: "$.caseRef",
                    type: "string",
                  },
                  status: {
                    label: "Status",
                    text: "$.status",
                    type: "string",
                  },
                  dateReceived: {
                    label: "Date Received",
                    text: "$.dateReceived",
                    type: "date",
                    format: "formatDate",
                  },
                },
              },
              tabs: {
                "case-details": {
                  content: [
                    {
                      title: "Applicant Details",
                      type: "object",
                      component: "list",
                      rows: [
                        {
                          text: "$.payload.answers.isPigFarmer",
                          type: "boolean",
                          label: "Are you a pig farmer?",
                          format: "yesNo",
                        },
                      ],
                    },
                    {
                      title: "Pig Stock Details",
                      type: "object",
                      component: "list",
                      rows: [
                        {
                          text: "$.payload.answers.totalPigs",
                          type: "number",
                          label: "Total Pigs",
                        },
                        {
                          text: "$.payload.answers.whitePigsCount",
                          type: "number",
                          label: "How many White pigs do you have?",
                        },
                        {
                          text: "$.payload.answers.britishLandracePigsCount",
                          type: "number",
                          label: "How many British Landrace pigs do you have?",
                        },
                        {
                          text: "$.payload.answers.berkshirePigsCount",
                          type: "number",
                          label: "How many Berkshire pigs do you have?",
                        },
                        {
                          text: "$.payload.answers.otherPigsCount",
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
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        // Revert to old format
        pages: {
          cases: {
            details: {
              banner: {
                title: { ref: "$.payload.businessName", type: "string" },
                summary: {
                  reference: {
                    label: "Reference",
                    ref: "$.caseRef",
                    type: "string",
                  },
                  status: { label: "Status", ref: "$.status", type: "string" },
                  dateReceived: {
                    label: "Date Received",
                    ref: "$.dateReceived",
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
                      type: "object",
                      fields: [
                        {
                          ref: "$.payload.answers.isPigFarmer",
                          type: "boolean",
                          label: "Are you a pig farmer?",
                        },
                      ],
                      component: "list",
                    },
                    {
                      title: "Pig Stock Details",
                      type: "object",
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
                      component: "list",
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  );
};
