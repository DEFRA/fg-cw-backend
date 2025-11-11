export const up = async (db) => {
  await db.collection("workflows").updateMany(
    {
      code: "methane",
    },
    [
      {
        $set: {
          phases: [
            {
              code: "default",
              name: "Default Phase",
              stages: "$stages",
            },
          ],
        },
      },
    ],
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateMany(
    {
      code: "methane",
    },
    [
      {
        $unset: "phases",
      },
    ],
  );
};
