/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db.collection("workflows").updateOne(
    {
      code: "frps-private-beta",
    },
    {
      $set: {
        "phases.0.stages.0.taskGroups.0.tasks.0.description": [
          {
            component: "heading",
            text: "Customer details review",
            level: 1,
          },
          {
            component: "ordered-list",
            items: [
              {
                text: "Go to Application to view submitted customer details.",
              },
              {
                text: "Check the submitted details match the details and permissions on the Rural Payments service (RPS).",
              },
              {
                text: "Come back to this page and confirm if the details match.",
              },
            ],
          },
          {
            component: "heading",
            text: "Customer detail review outcome",
            level: 2,
          },
        ],
      },
    },
  );
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  await db.collection("workflows").updateOne(
    {
      code: "frps-private-beta",
    },
    {
      $set: {
        "phases.0.stages.0.taskGroups.0.tasks.0.description": null,
      },
    },
  );
};
