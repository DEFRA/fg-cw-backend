export const up = async (db) => {
  await db
    .collection("cases")
    .updateMany(
      { originalConfigVersion: { $exists: false } },
      { $set: { originalConfigVersion: null, currentConfigVersion: null } },
    );
};
