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
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://fg-cw.com/grant-application.schema.json",
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The case code identifier"
        },
        clientRef: {
          type: "string",
          description: "The client reference for the application."
        },
        createdAt: {
          type: "string",
          format: "date-time",
          description: "The date and time when the application was created."
        },
        submittedAt: {
          type: "string",
          format: "date-time",
          description: "The date and time when the application was submitted."
        },
        data: {
          type: "array",
          description: "An array containing application data fields.",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "The unique identifier for the data field."
              },
              label: {
                type: "string",
                description:
                  "The label describing the purpose of the data field."
              },
              value: {
                oneOf: [
                  {
                    type: "string",
                    description:
                      "The string value of the data field if applicable."
                  },
                  {
                    type: "boolean",
                    description:
                      "A boolean value if the data field uses true/false."
                  }
                ]
              }
            },
            required: ["id", "label", "value"],
            additionalProperties: false
          }
        }
      },
      required: ["code", "clientRef", "createdAt", "submittedAt", "data"],
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
