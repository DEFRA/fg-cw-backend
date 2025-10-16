export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({}, { $set: { "stages.$[].description": "" } });
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany({}, { $unset: "stages.description" });
};
