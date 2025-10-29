/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db.collection("workflows").updateOne(
    {
      code: "frps-private-beta",
      "stages.taskGroups.code": "application-receipt-tasks",
    },
    {
      $set: {
        "stages.$[stage].taskGroups.$[group].tasks": [
          {
            code: "simple-review",
            name: "Simple Review",
            type: "boolean",
            description: null,
            statusOptions: [],
            requiredRoles: {
              allOf: ["ROLE_RPA_ADMIN"],
              anyOf: ["ROLE_RPA_FINANCE"],
            },
          },
          {
            code: "detail-review",
            name: "Detail Review",
            type: "boolean",
            description: null,
            statusOptions: [],
            requiredRoles: {
              allOf: ["ROLE_RPA_ADMIN", "ROLE_SFI_REFORM"],
              anyOf: ["ROLE_RPA_FINANCE", "ROLE_RPA_SENIOR_FINANCE"],
            },
          },
        ],
      },
    },
    {
      arrayFilters: [
        { "stage.code": "application-receipt" },
        { "group.code": "application-receipt-tasks" },
      ],
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
      "stages.taskGroups.code": "application-receipt-tasks",
    },
    {
      $set: {
        "stages.$[stage].taskGroups.$[group].tasks": [
          {
            code: "simple-review",
            name: "Simple Review",
            type: "boolean",
            description: null,
            statusOptions: [],
          },
        ],
      },
    },
    {
      arrayFilters: [
        { "stage.code": "application-receipt" },
        { "group.code": "application-receipt-tasks" },
      ],
    },
  );
};
