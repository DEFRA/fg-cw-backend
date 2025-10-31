export const up = async (db) => {
  await db.collection("cases").updateMany(
    {
      "timeline.data.stageCode": {
        $exists: true,
      },
    },
    { $set: { "timeline.data.phaseCode": "default" } },
  );
};

export const down = async (db) => {
  await db
    .collection("cases")
    .updateMany({}, { $unset: { "timeline.data.phaseCode": "" } });
};
