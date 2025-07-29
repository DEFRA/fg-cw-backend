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
