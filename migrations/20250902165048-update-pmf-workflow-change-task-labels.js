export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "stages.1.taskGroups.3.tasks.0.title":
          "SFI intersecting layers check 1",
        "stages.1.taskGroups.3.tasks.1.title":
          "SFI intersecting layers check 2",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "stages.1.taskGroups.3.tasks.0.title": "SFI intersecting layers check",
        "stages.1.taskGroups.3.tasks.1.title": "SFI intersecting layers check",
      },
    },
  );
};
