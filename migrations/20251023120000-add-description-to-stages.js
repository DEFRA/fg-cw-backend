export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({}, [{ $set: { "stages.description": null } }]);
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany({}, { $unset: "stages.description" });
};
