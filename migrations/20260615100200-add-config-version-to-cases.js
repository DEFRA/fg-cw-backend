export const up = async (db) => {
  await db
    .collection("cases")
    .updateMany(
      { configVersion: { $exists: false } },
      { $set: { configVersion: null } },
    );
};

export const down = async (db) => {
  await db
    .collection("cases")
    .updateMany({}, { $unset: { configVersion: "" } });
};
