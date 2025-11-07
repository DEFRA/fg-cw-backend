/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db.collection("workflows").updateOne(
    {
      code: "pigs-might-fly",
      "phases.stages.taskGroups.tasks.code": "check-rps-dual-funding",
    },
    {
      $set: {
        "phases.$[phase].stages.$[stage].taskGroups.$[group].tasks.$[task].requiredRoles":
          {
            allOf: ["ROLE_RPA_ADMIN"],
            anyOf: ["ROLE_RPA_FINANCE"],
          },
      },
    },
    {
      arrayFilters: [
        { "phase.code": "default" },
        { "stage.code": "assessment" },
        { "group.code": "check-application" },
        { "task.code": "check-rps-dual-funding" },
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
      code: "pigs-might-fly",
      "phases.stages.taskGroups.tasks.code": "check-rps-dual-funding",
    },
    {
      $unset: {
        "phases.$[phase].stages.$[stage].taskGroups.$[group].tasks.$[task].requiredRoles":
          "",
      },
    },
    {
      arrayFilters: [
        { "phase.code": "default" },
        { "stage.code": "assessment" },
        { "group.code": "check-application" },
        { "task.code": "check-rps-dual-funding" },
      ],
    },
  );
};
