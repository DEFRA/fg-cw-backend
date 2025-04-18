/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db.collection("workflows").insertOne({
    workflowCode: "GRANT-REF-1",
    description: "Workflow description",
    taskSections: [
      {
        id: "1",
        title: "Check application",
        taskGroups: [
          {
            id: "1",
            title: "Check application and documents",
            tasks: [
              {
                id: "1",
                inputType: "radio",
                prompt: "Is the first part OK?"
              },
              {
                id: "2",
                inputType: "radio",
                prompt: "Is the second part OK?"
              }
            ]
          },
          {
            id: "2",
            title: "Check for dual funding",
            tasks: [
              {
                id: "1",
                inputType: "radio",
                prompt: "Is the dual funding available?"
              }
            ]
          }
        ]
      },
      {
        id: "2",
        title: "Make Application Decision",
        taskGroups: [
          {
            id: "1",
            dependsOnActionCompletion: ["1", "2"],
            title: "Approve or reject application",
            tasks: [
              {
                id: "1",
                inputType: "select",
                options: [
                  {
                    label: "Approve",
                    value: "APPROVE"
                  },
                  {
                    label: "Reject",
                    value: "REJECT"
                  }
                ],
                prompt: "Approve or Reject?"
              }
            ]
          }
        ]
      }
    ],
    payloadSchema: {
      $id: "https://fg-cw.com/grant-application.schema.json",
      type: "object",
      properties: {
        clientRef: {
          type: "string"
        },
        code: {
          type: "string"
        },
        createdAt: {
          type: "object"
        },
        submittedAt: {
          type: "object"
        },
        identifiers: {
          type: "object",
          properties: {
            sbi: {
              type: "string"
            },
            frn: {
              type: "string"
            },
            crn: {
              type: "string"
            },
            defraId: {
              type: "string"
            }
          },
          required: ["sbi", "frn", "crn", "defraId"]
        },
        answers: {
          type: "object",
          properties: {
            scheme: {
              type: "string"
            },
            year: {
              type: "integer",
              minimum: 2000,
              maximum: 2100
            },
            hasCheckedLandIsUpToDate: {
              type: "boolean"
            },
            actionApplications: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  parcelId: {
                    type: "string"
                  },
                  sheetId: {
                    type: "string"
                  },
                  code: {
                    type: "string"
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
                    },
                    required: ["unit", "quantity"]
                  }
                },
                required: ["parcelId", "sheetId", "code", "appliedFor"]
              }
            }
          },
          required: [
            "scheme",
            "year",
            "hasCheckedLandIsUpToDate",
            "actionApplications"
          ]
        }
      },
      required: [
        "clientRef",
        "code",
        "createdAt",
        "submittedAt",
        "identifiers",
        "answers"
      ]
    }
  });
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  await db.collection("workflows").deleteOne({ workflowCode: "001" });
};
