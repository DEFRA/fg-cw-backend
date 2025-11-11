export const up = async (db) => {
  await db.collection("cases").updateMany(
    {},
    {
      $set: { "timeline.$[item].data.phaseCode": "default" },
    },
    {
      arrayFilters: [{ "item.data.stageCode": { $exists: true } }],
    },
  );
};

export const down = async (db) => {
  await db.collection("cases").updateMany(
    {},
    {
      $unset: { "timeline.$[item].data.phaseCode": "" },
    },
    {
      arrayFilters: [{ "item.data.stageCode": { $exists: true } }],
    },
  );
};
