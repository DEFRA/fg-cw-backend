export const up = async (db) => {
  await db.collection("workflows").updateMany(
    { code: { $in: ["pigs-might-fly", "frps-private-beta"] } },
    {
      $push: {
        stages: {
          $each: [
            {
              id: "award",
              title: "Award",
              taskGroups: [],
              actions: [],
              agreements: [],
            },
          ],
        },
      },
    },
  );

  await db.collection("cases").updateMany(
    { workflowCode: { $in: ["pigs-might-fly", "frps-private-beta"] } },
    {
      $push: {
        stages: {
          $each: [
            {
              id: "award",
              title: "Award",
              taskGroups: [],
              agreements: [],
            },
          ],
        },
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("cases").updateMany(
    { workflowCode: { $in: ["pigs-might-fly", "frps-private-beta"] } },
    {
      $pop: {
        stages: 1,
      },
    },
  );

  await db.collection("workflows").updateMany(
    { code: { $in: ["pigs-might-fly", "frps-private-beta"] } },
    {
      $pop: {
        stages: 1,
      },
    },
  );
};
