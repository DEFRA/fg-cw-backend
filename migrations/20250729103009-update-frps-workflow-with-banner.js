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
              tabs: {
                caseDetails: {
                  title: "Application",
                  sections: [
                    {
                      title: "Answers",
                      type: "list",
                      fields: [
                        {
                          ref: "$.payload.answers.scheme",
                          type: "string",
                          label: "Scheme",
                        },
                        {
                          ref: "$.payload.answers.year",
                          type: "number",
                          label: "Year",
                        },
                        {
                          ref: "$.payload.answers.hasCheckedLandIsUpToDate",
                          type: "boolean",
                          label: "Has checked land is up to date?",
                        },
                        {
                          ref: "$.payload.answers.agreementName",
                          type: "string",
                          label: "Agreement Name",
                        },
                      ],
                    },
                    {
                      title: "Action cases data",
                      type: "table",
                      fields: [
                        {
                          ref: "$.payload.answers.actionApplications[*].parcelId",
                          type: "string",
                          label: "Parcel Id",
                        },
                        {
                          ref: "$.payload.answers.actionApplications[*].sheetId",
                          type: "string",
                          label: "Sheet Id",
                        },
                        {
                          ref: "$.payload.answers.actionApplications[*].code",
                          type: "string",
                          label: "Code",
                        },
                        {
                          ref: "$.payload.answers.actionApplications[*].appliedFor",
                          type: "string",
                          label: "Applied For",
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
