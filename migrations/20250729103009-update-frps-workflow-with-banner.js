export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
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
                  sbi: {
                    label: "SBI",
                    ref: "$.payload.identifiers.sbi",
                    type: "string",
                  },
                  reference: {
                    label: "Reference",
                    ref: "$.clientRef",
                    type: "string",
                  },
                  scheme: {
                    label: "Scheme",
                    ref: "$.payload.answers.scheme",
                    type: "string",
                  },
                  createdAt: {
                    label: "Created At",
                    ref: "$.payload.createdAt",
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
    { code: "frps-private-beta" },
    {
      $set: {
        pages: {
          cases: {
            details: {
              banner: {
                summary: {
                  sbi: {
                    label: "SBI",
                    ref: "$.payload.identifiers.sbi",
                    type: "string",
                  },
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
