export const up = async (db) => {
  await db.collection("workflows").updateOne(
    {
      code: "frps-private-beta",
      "phases.stages.taskGroups.tasks.code": {
        $in: ["simple-review", "detail-review"],
      },
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
        { "stage.code": "application-receipt" },
        { "group.code": "application-receipt-tasks" },
        { "task.code": { $in: ["simple-review", "detail-review"] } },
      ],
    },
  );
};
