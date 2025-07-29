export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $unset: {
        payloadDefinition: "",
      },
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
                      type: "list",
                      fields: [
                        {
                          ref: "$.payload.answers.actionApplications.parcelId",
                          type: "string",
                          label: "Parcel Id",
                        },
                        {
                          ref: "$.payload.answers.actionApplications.sheetId",
                          type: "string",
                          label: "Sheet Id",
                        },
                        {
                          ref: "$.payload.answers.actionApplications.code",
                          type: "string",
                          label: "Code",
                        },
                        {
                          ref: "$.payload.answers.actionApplications.appliedFor",
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
      $unset: {
        pages: "",
      },
      $set: {
        payloadDefinition: {
          identifiers: {
            type: "object",
            properties: {
              sbi: {
                type: "string",
                label: "SBI",
              },
              frn: {
                type: "string",
                label: "FRN",
              },
              crn: {
                type: "string",
                label: "CRN",
              },
              defraId: {
                type: "string",
                label: "Defra ID",
              },
            },
          },
          answers: {
            type: "object",
            properties: {
              scheme: {
                type: "string",
                label: "Scheme type",
              },
              year: {
                type: "number",
                minimum: 2000,
                maximum: 2100,
                label: "Year",
              },
              hasCheckedLandIsUpToDate: {
                type: "boolean",
                label: "Has checked land is up to date?",
              },
              actionApplications: {
                type: "array",
                label: "Action applications",
                items: {
                  type: "object",
                  properties: {
                    parcelId: {
                      type: "string",
                      label: "Parcel ID",
                    },
                    sheetId: {
                      type: "string",
                      label: "Sheet ID",
                    },
                    code: {
                      type: "string",
                      label: "Code",
                    },
                    appliedFor: {
                      type: "object",
                      properties: {
                        unit: {
                          type: "string",
                          enum: ["ha", "acres", "sqm", "sqft"],
                        },
                        quantity: {
                          type: "number",
                          minimum: 0,
                        },
                      },
                    },
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
