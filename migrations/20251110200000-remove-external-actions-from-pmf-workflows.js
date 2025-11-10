export const up = async (db) => {
  await db
    .collection("workflows")
    .updateOne({ code: "pigs-might-fly" }, { $set: { externalActions: [] } });
};
