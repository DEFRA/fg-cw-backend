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
        id: {
          type: "string"
        },
        code: {
          type: "string"
        },
        clientRef: {
          type: "string"
        },
        caseName: {
          type: "string"
        },
        businessName: {
          type: "string"
        },
        createdAt: {
          type: "object"
        },
        submittedAt: {
          type: "object"
        },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                pattern: "^[0-9]+$"
              },
              label: {
                type: "string"
              },
              valueType: {
                type: "string",
                enum: ["string", "boolean", "date", "number"]
              },
              valueString: {
                type: "string"
              },
              valueBoolean: {
                type: "boolean"
              },
              valueDateTime: {
                type: "string",
                format: "date-time"
              },
              valueDate: {
                type: "string",
                format: "date"
              },
              valueNumber: {
                type: "number"
              }
            },
            required: ["id", "label", "valueType"]
          }
        }
      },
      required: [
        "id",
        "code",
        "clientRef",
        "caseName",
        "businessName",
        "createdAt",
        "submittedAt",
        "data"
      ],
      additionalProperties: false
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
