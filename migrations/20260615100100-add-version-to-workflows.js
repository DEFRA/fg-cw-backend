export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany(
      { version: { $exists: false } },
      { $set: { version: "1.0.0" } },
    );

  await db
    .collection("workflows")
    .createIndex({ code: 1, version: 1 }, { unique: true });
};

export const down = async (db) => {
  await db.collection("workflows").dropIndex("code_1_version_1");
  await db.collection("workflows").updateMany({}, { $unset: { version: "" } });
};
