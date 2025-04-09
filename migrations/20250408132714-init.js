/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db.collection("workflows").insertOne({
    workflowCode: "001",
    description: "Example workflow description",
    caseRef: "CASE-REF-1",
    caseName: "Water management R3",
    caseGroup: "Northampton Reservoir",
    actionGroups: [
      {
        id: "1",
        title: "Check application",
        actions: [
          {
            id: "1",
            label: "Check application and documents",
            tasks: [
              {
                id: "1",
                type: "radio",
                prompt: "Is the first part OK?"
              },
              {
                id: "2",
                type: "radio",
                prompt: "Is the second part OK?"
              }
            ]
          },
          {
            id: "2",
            label: "Check for dual funding",
            tasks: [
              {
                id: "1",
                type: "radio",
                prompt: "Is the dual funding available?"
              }
            ]
          }
        ]
      },
      {
        id: "2",
        title: "Make Application Decision",
        actions: [
          {
            id: "1",
            dependsOnActionCompletion: ["1", "2"],
            label: "Approve or reject application",
            tasks: [
              {
                id: "1",
                type: "select",
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
    ]
  });
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  await db.collection("workflows").deleteOne({ workflowCode: "001" });
};
