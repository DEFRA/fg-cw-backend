export const up = async (db) => {
  await db.collection("workflows").updateMany({}, [
    {
      $unset: "stages",
    },
  ]);
};

export const down = async (db) => {
  await db.collection("workflows").updateMany({}, [
    {
      $set: {
        stages: "$phases.0.stages",
      },
    },
  ]);
};
