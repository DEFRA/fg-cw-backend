export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "stages.1.taskGroups.3.tasks.2.id": "so3750-confirm-area-check",
      },
    },
  );

  await db.collection("cases").updateMany(
    {
      workflowCode: "pigs-might-fly",
    },
    {
      $set: {
        "stages.1.taskGroups.3.tasks.2.id": "so3750-confirm-area-check",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "stages.1.taskGroups.3.tasks.2.id": "so3757-confirm-area-check",
      },
    },
  );

  await db.collection("cases").updateMany(
    {
      workflowCode: "pigs-might-fly",
    },
    {
      $set: {
        "stages.1.taskGroups.3.tasks.2.id": "so3757-confirm-area-check",
      },
    },
  );
};
