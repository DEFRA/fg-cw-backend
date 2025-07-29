export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  ref: "$.payload.businessName",
                  type: "string",
                },
                summary: {
                  reference: {
                    label: "Reference",
                    ref: "$.caseRef",
                    type: "string",
                  },
                  status: {
                    label: "Status",
                    ref: "$.status",
                    type: "string",
                  },
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
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
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
            },
          },
        },
      },
    },
  );
};
