export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "stages.1.taskGroups.2.tasks.0.title": "SFI available area check 1",
        "stages.1.taskGroups.2.tasks.1.title": "SFI available area check 2",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "stages.1.taskGroups.2.tasks.0.title": "SFI available area check",
        "stages.1.taskGroups.2.tasks.1.title": "SFI available area check",
      },
    },
  );
};
