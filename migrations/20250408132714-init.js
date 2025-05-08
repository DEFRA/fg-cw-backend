/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db.collection("workflows").insertOne({
    code: "frps-private-beta",
    payloadDefinition: {
      identifiers: {
        type: "object",
        properties: {
          sbi: {
            type: "string",
            label: "SBI"
          },
          frn: {
            type: "string",
            label: "FRN"
          },
          crn: {
            type: "string",
            label: "CRN"
          },
          defraId: {
            type: "string",
            label: "Defra ID"
          }
        }
      },
      answers: {
        type: "object",
        properties: {
          scheme: {
            type: "string",
            label: "Scheme type"
          },
          year: {
            type: "number",
            minimum: 2000,
            maximum: 2100,
            label: "Year"
          },
          hasCheckedLandIsUpToDate: {
            type: "boolean",
            label: "Has checked land is up to date?"
          },
          actionApplications: {
            type: "array",
            label: "Action applications",
            items: {
              type: "object",
              properties: {
                parcelId: {
                  type: "string",
                  label: "Parcel ID"
                },
                sheetId: {
                  type: "string",
                  label: "Sheet ID"
                },
                code: {
                  type: "string",
                  label: "Code"
                },
                appliedFor: {
                  type: "object",
                  properties: {
                    unit: {
                      type: "string",
                      enum: ["ha", "acres", "sqm", "sqft"]
                    },
                    quantity: {
                      type: "number",
                      minimum: 0
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  await db.collection("workflows").deleteOne({ code: "001" });
};
