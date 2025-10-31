export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({}, { $set: { "phases.$[].stages.$[].description": null } });
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany({}, { $unset: { "phases.$[].stages.$[].description": "" } });
};
