export const up = async (db) => {
  await db.collection("workflows").updateMany({}, [
    {
      $set: {
        "stages.taskGroups.tasks.statusOptions": [],
      },
    },
  ]);
};

export const down = async (db) => {
  await db.collection("workflows").updateMany({}, [
    {
      $unset: "stages.taskGroups.tasks.statusOptions",
    },
  ]);
};
