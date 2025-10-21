export const up = async (db) => {
  await db.collection("workflows").updateMany({}, [
    {
      $set: { "stages.statuses": [] },
    },
  ]);
};

export const down = async (db) => {
  await db.collection("workflows").updateMany({}, [
    {
      $unset: "stages.statuses",
    },
  ]);
};
